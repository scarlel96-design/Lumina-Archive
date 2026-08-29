#pragma once
// G0/G2: declarations only. Do not include 7z.h or minizip here.

#include <cstdint>
#include <string>
#include <vector>

namespace lumina::engine {

inline constexpr int kProtocolVersion = 1;
inline constexpr uint32_t kMaxControlFrame = 1024u * 1024u;
inline constexpr uint32_t kMaxSecretBytes = 64u * 1024u;

struct Capability {
  const char* format;
  bool create;
  bool extract;
  const char* owner;
};

struct WorkerConfig {
  std::string job_id;
  int protocol_version = kProtocolVersion;
  std::wstring control_pipe;
  std::wstring secret_pipe;
};

std::vector<Capability> capabilities();
int run_worker(const WorkerConfig& cfg);

} // namespace lumina::engine
