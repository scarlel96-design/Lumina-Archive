#include "lumina/engine.hpp"
#include "lumina/g3_job.hpp"
#include "framing.hpp"
#include "protocol.hpp"
#include "named_pipe_client.hpp"
#include "secret_pipe_client.hpp"

#include <atomic>
#include <chrono>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

namespace lumina::engine {
namespace {

enum class Work { Run, Pause, Stop };

struct Ctx {
  WorkerConfig cfg;
  void* pipe = nullptr;
  std::mutex write_mu;
  std::atomic<int> event_seq{0};
  std::atomic<Work> work{Work::Run};
  std::atomic<bool> alive{true};
  std::chrono::steady_clock::time_point started = std::chrono::steady_clock::now();
  g3::JobCtx g3;
  bool g3_mode = false;
  int pause_seq = -1;
  int resume_seq = -1;
};

bool emit(Ctx& ctx, const std::string& type, const std::string& payload) {
  /* Seq and byte order must be the same: heartbeat and G3 worker both emit. */
  std::lock_guard<std::mutex> lock(ctx.write_mu);
  int seq = ctx.event_seq.fetch_add(1);
  auto json = lumina::ipc::make_event(kProtocolVersion, ctx.cfg.job_id, seq, type, payload);
  return lumina::ipc::write_frame(ctx.pipe, json);
}

bool emit_thunk(void* user, const std::string& type, const std::string& payload) {
  return emit(*static_cast<Ctx*>(user), type, payload);
}

void heartbeat_thread(Ctx* ctx) {
  while (ctx->alive.load()) {
    auto up = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - ctx->started).count();
    std::string state = ctx->work.load() == Work::Pause ? "paused" : "running";
    std::string payload = std::string("{\"uptime_ms\":") + std::to_string(up) + ",\"state\":\"" + state + "\"}";
    if (!emit(*ctx, "heartbeat", payload)) break;
    for (int i = 0; i < 10 && ctx->alive.load(); ++i)
      std::this_thread::sleep_for(std::chrono::milliseconds(100));
  }
}

void wipe(std::vector<uint8_t>& s) {
#ifdef _WIN32
  if (!s.empty()) SecureZeroMemory(s.data(), s.size());
#endif
  s.assign(s.size(), 0);
  s.clear();
}

#ifdef _WIN32
std::wstring utf8_to_wide(const std::string& s) {
  if (s.empty()) return {};
  int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), nullptr, 0);
  std::wstring w(static_cast<size_t>(n), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), w.data(), n);
  return w;
}
#endif

} // namespace

int run_worker(const WorkerConfig& cfg) {
#ifndef _WIN32
  (void)cfg;
  return 2;
#else
  Ctx ctx;
  ctx.cfg = cfg;
  ctx.pipe = lumina::ipc::connect_pipe(cfg.control_pipe);
  if (!ctx.pipe) return 3;

  int expected_cmd = 0;
  std::thread hb;
  bool hb_started = false;
  std::thread worker;
  bool worker_started = false;
  std::vector<uint8_t> secret;

  while (ctx.alive.load()) {
    std::string json;
    if (!lumina::ipc::read_frame(ctx.pipe, json, kMaxControlFrame)) break;
    lumina::ipc::Envelope env;
    std::string err;
    if (!lumina::ipc::parse_envelope(json, env, err)) break;
    if (env.protocol_version != kProtocolVersion || env.job_id != cfg.job_id) break;
    if (env.seq != expected_cmd) break;
    expected_cmd++;

    if (env.type == "start") {
      if (env.secret_required) {
        if (!lumina::ipc::receive_one_shot_secret(cfg.secret_pipe, secret, kMaxSecretBytes)) {
          emit(ctx, "failed", "{\"code\":\"SecretFrameInvalid\"}");
          break;
        }
      }
      std::string payload = std::string("{\"command_seq\":") + std::to_string(env.seq) + "}";
      emit(ctx, "accepted", payload);
      hb = std::thread(heartbeat_thread, &ctx);
      hb_started = true;
      const bool g3 = env.operation == "test" && !env.source_path.empty();
      ctx.g3_mode = g3;
      ctx.g3.emit = emit_thunk;
      ctx.g3.emit_user = &ctx;
      if (g3) {
        auto path = utf8_to_wide(env.source_path);
        auto hint = env.format_hint;
        worker = std::thread([&, path, hint] {
          int cancelled = g3::run_test_job(path, hint, secret, &ctx.g3, emit_thunk, &ctx);
          wipe(secret);
          if (cancelled) {
            /* cancelled event is emitted by command path if still alive */
          }
          ctx.alive.store(false);
        });
        worker_started = true;
      } else {
        wipe(secret);
      }
    } else if (env.type == "pause") {
      ctx.work.store(Work::Pause);
      ctx.pause_seq = env.seq;
      if (ctx.g3_mode) {
        ctx.g3.pause_seq = env.seq;
        ctx.g3.pause_acked.store(0);
        ctx.g3.pause.store(1);
      } else {
        emit(ctx, "paused", std::string("{\"command_seq\":") + std::to_string(env.seq) + "}");
      }
    } else if (env.type == "resume") {
      ctx.work.store(Work::Run);
      ctx.resume_seq = env.seq;
      if (ctx.g3_mode) {
        ctx.g3.pause.store(0);
        g3::wake(&ctx.g3);
      }
      emit(ctx, "resumed", std::string("{\"command_seq\":") + std::to_string(env.seq) + "}");
    } else if (env.type == "cancel") {
      if (ctx.g3_mode) {
        ctx.g3.cancel.store(1);
        ctx.g3.pause.store(0);
        g3::wake(&ctx.g3);
      }
      emit(ctx, "cancelled", std::string("{\"command_seq\":") + std::to_string(env.seq) + "}");
      ctx.alive.store(false);
    } else if (env.type == "shutdown") {
      if (ctx.g3_mode) {
        ctx.g3.cancel.store(1);
        ctx.g3.alive.store(0);
        g3::wake(&ctx.g3);
      }
      ctx.alive.store(false);
    } else {
      break;
    }
  }

  ctx.alive.store(false);
  ctx.g3.alive.store(0);
  ctx.g3.cancel.store(1);
  g3::wake(&ctx.g3);
  if (worker_started) worker.join();
  if (hb_started) hb.join();
  wipe(secret);
  lumina::ipc::close_pipe(ctx.pipe);
  return 0;
#endif
}

} // namespace lumina::engine
