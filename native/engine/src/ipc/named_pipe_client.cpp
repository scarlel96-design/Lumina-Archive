#include "named_pipe_client.hpp"

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

namespace lumina::ipc {

void* connect_pipe(const std::wstring& name) {
#ifdef _WIN32
  for (int i = 0; i < 50; ++i) {
    HANDLE h = CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h != INVALID_HANDLE_VALUE) return h;
    if (GetLastError() != ERROR_PIPE_BUSY) return nullptr;
    WaitNamedPipeW(name.c_str(), 200);
  }
  return nullptr;
#else
  (void)name;
  return nullptr;
#endif
}

void close_pipe(void* handle) {
#ifdef _WIN32
  if (handle) CloseHandle(static_cast<HANDLE>(handle));
#else
  (void)handle;
#endif
}

} // namespace lumina::ipc
