#pragma once
// G0: declarations only. Do not include 7z.h or minizip here.

#include <cstdint>
#include <string>
#include <vector>

namespace lumina::engine {

inline constexpr int kProtocolVersion = 1;

struct Capability {
  const char* format;
  bool create;
  bool extract;
  const char* owner; // "7z.dll" | "minizip-ng" | "libarchive"
};

std::vector<Capability> capabilities();

int run_worker();

} // namespace lumina::engine
