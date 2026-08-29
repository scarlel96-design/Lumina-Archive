#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace lumina::ipc {

bool valid_utf8(const uint8_t* p, size_t n);
bool read_exact(void* handle, void* buf, uint32_t n);
bool write_all(void* handle, const void* buf, uint32_t n);
bool read_frame(void* handle, std::string& json_out, uint32_t max_len);
bool write_frame(void* handle, const std::string& json);
bool read_secret_frame(void* handle, std::vector<uint8_t>& out, uint32_t max_len);

} // namespace lumina::ipc
