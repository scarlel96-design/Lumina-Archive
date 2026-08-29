#pragma once
#include <atomic>
#include <condition_variable>
#include <mutex>
#include <string>
#include <vector>

namespace lumina::engine::g3 {

using EmitFn = bool (*)(void* emit_user, const std::string& type, const std::string& payload);

struct JobCtx {
  std::atomic<int> cancel{0};
  std::atomic<int> pause{0};
  std::atomic<int> alive{1};
  std::atomic<int> pause_acked{0};
  int pause_seq = -1;
  EmitFn emit = nullptr;
  void* emit_user = nullptr;
  std::mutex mu;
  std::condition_variable cv;
};

int run_test_job(const std::wstring& source_path, const std::string& format_hint, std::vector<uint8_t>& secret,
                 JobCtx* ctx, EmitFn emit, void* emit_user);
void wake(JobCtx* ctx);

} // namespace lumina::engine::g3
