#include "lumina/engine.hpp"
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
};

bool emit(Ctx& ctx, const std::string& type, const std::string& payload) {
  int seq = ctx.event_seq.fetch_add(1);
  auto json = lumina::ipc::make_event(kProtocolVersion, ctx.cfg.job_id, seq, type, payload);
  std::lock_guard<std::mutex> lock(ctx.write_mu);
  return lumina::ipc::write_frame(ctx.pipe, json);
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
        std::vector<uint8_t> secret;
        if (!lumina::ipc::receive_one_shot_secret(cfg.secret_pipe, secret, kMaxSecretBytes)) {
          emit(ctx, "failed", "{\"code\":\"SecretFrameInvalid\"}");
          break;
        }
        wipe(secret);
      }
      std::string payload = std::string("{\"command_seq\":") + std::to_string(env.seq) + "}";
      emit(ctx, "accepted", payload);
      hb = std::thread(heartbeat_thread, &ctx);
      hb_started = true;
    } else if (env.type == "pause") {
      ctx.work.store(Work::Pause);
      emit(ctx, "paused", std::string("{\"command_seq\":") + std::to_string(env.seq) + "}");
    } else if (env.type == "resume") {
      ctx.work.store(Work::Run);
      emit(ctx, "resumed", std::string("{\"command_seq\":") + std::to_string(env.seq) + "}");
    } else if (env.type == "cancel") {
      emit(ctx, "cancelled", std::string("{\"command_seq\":") + std::to_string(env.seq) + "}");
      ctx.alive.store(false);
    } else if (env.type == "shutdown") {
      ctx.alive.store(false);
    } else {
      break;
    }
  }

  ctx.alive.store(false);
  if (hb_started) hb.join();
  lumina::ipc::close_pipe(ctx.pipe);
  return 0;
#endif
}

} // namespace lumina::engine
