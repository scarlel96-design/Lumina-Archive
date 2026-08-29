#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace lumina::ipc {

bool receive_one_shot_secret(const std::wstring& pipe, std::vector<uint8_t>& secret, uint32_t max_len);

} // namespace lumina::ipc
