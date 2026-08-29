#include "internal.hpp"

#include <cstring>
#include <string>

namespace lumina::sevenzip {
namespace {

DllState g_dll;
std::mutex g_dll_mu;

int32_t check_arch(const wchar_t* path) {
  uint16_t machine = 0;
  int32_t st = pe_machine(path, &machine);
  if (st != LUMINA_7Z_OK) return st;
  if (machine != host_pe_machine()) return LUMINA_7Z_DLL_ARCH_MISMATCH;
  return LUMINA_7Z_OK;
}

} // namespace

DllState& dll() { return g_dll; }

int32_t load_official_dll(const wchar_t* abs_path) {
  std::lock_guard<std::mutex> lock(g_dll_mu);
  if (!abs_path || !*abs_path) return LUMINA_7Z_ARG;
  if (g_dll.module) {
    if (g_dll.path == abs_path) return LUMINA_7Z_OK;
    return LUMINA_7Z_INTERNAL;
  }
  if (GetFileAttributesW(abs_path) == INVALID_FILE_ATTRIBUTES) return LUMINA_7Z_DLL_NOT_FOUND;
  int32_t st = check_arch(abs_path);
  if (st != LUMINA_7Z_OK) return st;

  HMODULE mod = LoadLibraryExW(
      abs_path,
      nullptr,
      LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32);
  if (!mod) return LUMINA_7Z_DLL_NOT_FOUND;

  auto create = reinterpret_cast<Func_CreateObject>(GetProcAddress(mod, "CreateObject"));
  auto nfmt = reinterpret_cast<Func_GetNumberOfFormats>(GetProcAddress(mod, "GetNumberOfFormats"));
  auto prop2 = reinterpret_cast<Func_GetHandlerProperty2>(GetProcAddress(mod, "GetHandlerProperty2"));
  if (!create || !nfmt || !prop2) {
    FreeLibrary(mod);
    return LUMINA_7Z_REQUIRED_EXPORT_MISSING;
  }
  g_dll.module = mod;
  g_dll.create_object = create;
  g_dll.get_number_of_formats = nfmt;
  g_dll.get_handler_property2 = prop2;
  g_dll.path = abs_path;
  g_dll.arch = host_arch_name();

  std::vector<Handler> handlers;
  enumerate_handlers(handlers);
  g_dll.handlers = static_cast<uint32_t>(handlers.size());
  for (const auto& h : handlers) {
    if (_stricmp(h.name.c_str(), "7z") == 0) g_dll.has_7z = true;
    if (_stricmp(h.name.c_str(), "zip") == 0) g_dll.has_zip = true;
  }
  return LUMINA_7Z_OK;
}

void unload_official_dll() {
  std::lock_guard<std::mutex> lock(g_dll_mu);
  if (g_dll.module) {
    FreeLibrary(g_dll.module);
    g_dll = DllState{};
  }
}

int32_t enumerate_handlers(std::vector<Handler>& out) {
  out.clear();
  if (!g_dll.get_number_of_formats || !g_dll.get_handler_property2) return LUMINA_7Z_REQUIRED_EXPORT_MISSING;
  UInt32 n = 0;
  HRESULT hr = g_dll.get_number_of_formats(&n);
  if (hr != S_OK) return map_hresult(hr);
  out.reserve(n);
  for (UInt32 i = 0; i < n; ++i) {
    Handler h;
    PROPVARIANT v;
    PropVariantInit(&v);
    if (g_dll.get_handler_property2(i, NArchive::NHandlerPropID::kName, &v) == S_OK)
      h.name = prop_bstr_utf8(v);
    clear_prop(v);
    PropVariantInit(&v);
    if (g_dll.get_handler_property2(i, NArchive::NHandlerPropID::kClassID, &v) == S_OK) {
      if (v.vt == VT_BSTR && v.bstrVal && SysStringByteLen(v.bstrVal) >= sizeof(GUID))
        std::memcpy(&h.clsid, v.bstrVal, sizeof(GUID));
    }
    clear_prop(v);
    PropVariantInit(&v);
    if (g_dll.get_handler_property2(i, NArchive::NHandlerPropID::kExtension, &v) == S_OK)
      h.ext = prop_bstr_utf8(v);
    clear_prop(v);
    PropVariantInit(&v);
    if (g_dll.get_handler_property2(i, NArchive::NHandlerPropID::kUpdate, &v) == S_OK) {
      int32_t b = 0;
      prop_to_bool(v, &b);
      h.update = b == 1;
    }
    clear_prop(v);
    if (h.name.empty()) continue;
    out.push_back(std::move(h));
  }
  return LUMINA_7Z_OK;
}

} // namespace lumina::sevenzip
