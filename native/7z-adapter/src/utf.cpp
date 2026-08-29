#include "internal.hpp"

#include <windows.h>

namespace lumina::sevenzip {

void secure_wipe(void* p, size_t n) {
  if (p && n) SecureZeroMemory(p, n);
}

std::string wide_to_utf8(const wchar_t* s, int nchars) {
  if (!s) return {};
  if (nchars < 0) nchars = static_cast<int>(wcslen(s));
  if (nchars == 0) return {};
  int n = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, s, nchars, nullptr, 0, nullptr, nullptr);
  if (n <= 0) return {};
  std::string out(static_cast<size_t>(n), '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, s, nchars, out.data(), n, nullptr, nullptr);
  return out;
}

int32_t utf8_to_wide(const uint8_t* bytes, uint32_t len, std::vector<wchar_t>& out) {
  out.clear();
  if (!bytes || len == 0) return LUMINA_7Z_OK;
  int n = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, reinterpret_cast<const char*>(bytes), static_cast<int>(len), nullptr, 0);
  if (n <= 0) return LUMINA_7Z_INVALID_UTF8;
  out.resize(static_cast<size_t>(n) + 1, L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, reinterpret_cast<const char*>(bytes), static_cast<int>(len), out.data(), n) <= 0)
    return LUMINA_7Z_INVALID_UTF8;
  return LUMINA_7Z_OK;
}

int32_t Utf16Password::set_utf8(const uint8_t* bytes, uint32_t len) {
  wipe();
  if (!bytes || len == 0) return LUMINA_7Z_OK;
  return utf8_to_wide(bytes, len, w_);
}

BSTR Utf16Password::alloc_bstr() const {
  if (w_.empty()) return SysAllocString(L"");
  return SysAllocString(w_.data());
}

void Utf16Password::wipe() {
  if (!w_.empty()) secure_wipe(w_.data(), w_.size() * sizeof(wchar_t));
  w_.clear();
}

void clear_prop(PROPVARIANT& p) {
  PropVariantClear(&p);
}

int32_t prop_to_i64(const PROPVARIANT& p, int64_t* out) {
  if (!out) return LUMINA_7Z_ARG;
  switch (p.vt) {
    case VT_EMPTY:
    case VT_NULL:
      *out = -1;
      return LUMINA_7Z_OK;
    case VT_UI1:
      *out = p.bVal;
      return LUMINA_7Z_OK;
    case VT_UI2:
      *out = p.uiVal;
      return LUMINA_7Z_OK;
    case VT_UI4:
      *out = p.ulVal;
      return LUMINA_7Z_OK;
    case VT_UI8:
      *out = static_cast<int64_t>(p.uhVal.QuadPart);
      return LUMINA_7Z_OK;
    case VT_I4:
      *out = p.lVal;
      return LUMINA_7Z_OK;
    case VT_I8:
      *out = p.hVal.QuadPart;
      return LUMINA_7Z_OK;
    default:
      *out = -1;
      return LUMINA_7Z_OK;
  }
}

int32_t prop_to_bool(const PROPVARIANT& p, int32_t* out) {
  if (!out) return LUMINA_7Z_ARG;
  if (p.vt == VT_EMPTY || p.vt == VT_NULL) {
    *out = -1;
    return LUMINA_7Z_OK;
  }
  if (p.vt == VT_BOOL) {
    *out = p.boolVal ? 1 : 0;
    return LUMINA_7Z_OK;
  }
  *out = -1;
  return LUMINA_7Z_OK;
}

std::string prop_bstr_utf8(const PROPVARIANT& p) {
  if (p.vt != VT_BSTR || !p.bstrVal) return {};
  return wide_to_utf8(p.bstrVal);
}

} // namespace lumina::sevenzip
