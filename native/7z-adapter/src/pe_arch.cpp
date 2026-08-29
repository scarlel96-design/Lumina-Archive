#include "internal.hpp"

#include <winnt.h>

namespace lumina::sevenzip {

uint16_t host_pe_machine() {
#if defined(_M_X64)
  return IMAGE_FILE_MACHINE_AMD64;
#elif defined(_M_ARM64)
  return IMAGE_FILE_MACHINE_ARM64;
#else
  return 0;
#endif
}

const char* host_arch_name() {
#if defined(_M_X64)
  return "x64";
#elif defined(_M_ARM64)
  return "arm64";
#else
  return "unknown";
#endif
}

int32_t pe_machine(const wchar_t* path, uint16_t* machine) {
  if (!path || !machine) return LUMINA_7Z_ARG;
  *machine = 0;
  HANDLE f = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (f == INVALID_HANDLE_VALUE) return LUMINA_7Z_DLL_NOT_FOUND;
  HANDLE map = CreateFileMappingW(f, nullptr, PAGE_READONLY, 0, 0, nullptr);
  if (!map) {
    CloseHandle(f);
    return LUMINA_7Z_IO_ERROR;
  }
  auto* base = static_cast<uint8_t*>(MapViewOfFile(map, FILE_MAP_READ, 0, 0, 0));
  if (!base) {
    CloseHandle(map);
    CloseHandle(f);
    return LUMINA_7Z_IO_ERROR;
  }
  int32_t st = LUMINA_7Z_BACKEND_INCOMPATIBLE;
  auto* dos = reinterpret_cast<IMAGE_DOS_HEADER*>(base);
  if (dos->e_magic == IMAGE_DOS_SIGNATURE) {
    auto* nt = reinterpret_cast<IMAGE_NT_HEADERS*>(base + dos->e_lfanew);
    if (nt->Signature == IMAGE_NT_SIGNATURE) {
      *machine = nt->FileHeader.Machine;
      st = LUMINA_7Z_OK;
    }
  }
  UnmapViewOfFile(base);
  CloseHandle(map);
  CloseHandle(f);
  return st;
}

} // namespace lumina::sevenzip
