#include "secret_pipe_client.hpp"
#include "named_pipe_client.hpp"
#include "framing.hpp"

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

namespace lumina::ipc {

bool receive_one_shot_secret(const std::wstring& pipe, std::vector<uint8_t>& secret, uint32_t max_len) {
  void* h = connect_pipe(pipe);
  if (!h) return false;
  bool ok = read_secret_frame(h, secret, max_len);
  close_pipe(h);
  return ok;
}

void wipe_secret(std::vector<uint8_t>& secret) {
#ifdef _WIN32
  if (!secret.empty()) SecureZeroMemory(secret.data(), secret.size());
#endif
  secret.clear();
  secret.shrink_to_fit();
}

} // namespace lumina::ipc
