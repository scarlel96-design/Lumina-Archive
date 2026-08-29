#pragma once
#include <string>

namespace lumina::ipc {

void* connect_pipe(const std::wstring& name);
void close_pipe(void* handle);

} // namespace lumina::ipc
