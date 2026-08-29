#include "lumina/g3_job.hpp"
#include "lumina/seven_zip_abi.h"

#include <chrono>
#include <cstring>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

namespace lumina::engine::g3 {
#ifdef _WIN32

struct Host {
  lumina_7z_api_v1 api{};
  HMODULE adapter = nullptr;
};

static std::wstring sibling(const wchar_t* name) {
  wchar_t buf[MAX_PATH]{};
  GetModuleFileNameW(nullptr, buf, MAX_PATH);
  std::wstring p(buf);
  auto slash = p.find_last_of(L"\\/");
  if (slash == std::wstring::npos) return name;
  return p.substr(0, slash + 1) + name;
}

static int32_t load_host(Host* h) {
  auto path = sibling(L"lumina-7z-adapter.dll");
  h->adapter = LoadLibraryExW(path.c_str(), nullptr, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32);
  if (!h->adapter) return LUMINA_7Z_BACKEND_UNAVAILABLE;
  using GetApi = int32_t(__cdecl*)(lumina_7z_api_v1*);
  auto get = reinterpret_cast<GetApi>(GetProcAddress(h->adapter, "lumina_7z_adapter_get_api_v1"));
  if (!get) return LUMINA_7Z_BACKEND_INCOMPATIBLE;
  h->api.size = sizeof(h->api);
  if (get(&h->api) != LUMINA_7Z_OK || h->api.abi_version != LUMINA_7Z_ABI_VERSION)
    return LUMINA_7Z_ADAPTER_ABI_MISMATCH;
  auto dll = sibling(L"7z.dll");
  return h->api.initialize(dll.c_str());
}

static int32_t is_cancel(void* u) { return static_cast<JobCtx*>(u)->cancel.load(); }

static int32_t wait_paused(void* u) {
  auto* c = static_cast<JobCtx*>(u);
  if (c->pause.load()) {
    if (c->emit && c->pause_acked.exchange(1) == 0) {
      std::string payload = std::string("{\"command_seq\":") + std::to_string(c->pause_seq < 0 ? 0 : c->pause_seq) + "}";
      c->emit(c->emit_user, "paused", payload);
    }
  }
  std::unique_lock<std::mutex> lock(c->mu);
  c->cv.wait(lock, [&] { return !c->pause.load() || c->cancel.load() || !c->alive.load(); });
  return c->alive.load() && !c->cancel.load() ? 1 : 0;
}

static const char* status_code(int32_t st) {
  switch (st) {
    case LUMINA_7Z_OK: return "OK";
    case LUMINA_7Z_NOT_ARCHIVE: return "NotArchive";
    case LUMINA_7Z_PASSWORD_REQUIRED: return "PasswordRequired";
    case LUMINA_7Z_WRONG_PASSWORD: return "WrongPassword";
    case LUMINA_7Z_DATA_ERROR: return "DataError";
    case LUMINA_7Z_CRC_ERROR: return "CrcError";
    case LUMINA_7Z_HEADER_ERROR: return "HeaderError";
    case LUMINA_7Z_UNEXPECTED_END: return "UnexpectedEnd";
    case LUMINA_7Z_UNSUPPORTED_METHOD: return "UnsupportedMethod";
    case LUMINA_7Z_CANCELLED: return "Cancelled";
    case LUMINA_7Z_BACKEND_UNAVAILABLE: return "BackendUnavailable";
    case LUMINA_7Z_DLL_NOT_FOUND: return "DllNotFound";
    case LUMINA_7Z_DLL_ARCH_MISMATCH: return "DllArchitectureMismatch";
    case LUMINA_7Z_REQUIRED_EXPORT_MISSING: return "RequiredExportMissing";
    case LUMINA_7Z_IO_ERROR: return "IoError";
    default: return "ArchiveOpenFailed";
  }
}

static std::string json_escape(const char* s) {
  std::string o = "\"";
  for (; s && *s; ++s) {
    unsigned char c = static_cast<unsigned char>(*s);
    if (c == '"' || c == '\\') {
      o.push_back('\\');
      o.push_back(*s);
    } else if (c >= 0x20) {
      o.push_back(*s);
    }
  }
  o.push_back('"');
  return o;
}

struct ProgressUser {
  EmitFn emit;
  void* emit_user;
  std::chrono::steady_clock::time_point last = std::chrono::steady_clock::now();
};

static int32_t report_progress(void* u, uint64_t done, int64_t total, uint32_t entries_done, uint32_t entries_total, const char* phase) {
  auto* p = static_cast<ProgressUser*>(u);
  auto now = std::chrono::steady_clock::now();
  bool last = total >= 0 && done == static_cast<uint64_t>(total);
  if (!last && now - p->last < std::chrono::milliseconds(80)) return 0;
  p->last = now;
  std::string payload = std::string("{\"bytes_done\":") + std::to_string(done) +
                        ",\"bytes_total\":" + (total < 0 ? std::string("null") : std::to_string(total)) +
                        ",\"entries_done\":" + std::to_string(entries_done) +
                        ",\"entries_total\":" + std::to_string(entries_total) +
                        ",\"phase\":" + json_escape(phase ? phase : "test") + "}";
  p->emit(p->emit_user, "progress", payload);
  return 0;
}

int run_test_job(const std::wstring& source_path, const std::string& format_hint, std::vector<uint8_t>& secret,
                 JobCtx* ctx, EmitFn emit, void* emit_user) {
  Host host{};
  int32_t st = load_host(&host);
  if (st != LUMINA_7Z_OK) {
    emit(emit_user, "failed", std::string("{\"code\":\"") + status_code(st) + "\"}");
    return 0;
  }
  ProgressUser pu;
  pu.emit = emit;
  pu.emit_user = emit_user;
  struct Wrap {
    JobCtx* ctx;
    ProgressUser* pu;
  } wrap{ctx, &pu};

  lumina_7z_bridge br{};
  br.size = sizeof(br);
  br.user = &wrap;
  br.is_cancel_requested = [](void* u) { return is_cancel(static_cast<Wrap*>(u)->ctx); };
  br.wait_if_paused = [](void* u) { return wait_paused(static_cast<Wrap*>(u)->ctx); };
  br.report_progress = [](void* u, uint64_t d, int64_t t, uint32_t ed, uint32_t et, const char* ph) {
    return report_progress(static_cast<Wrap*>(u)->pu, d, t, ed, et, ph);
  };

  lumina_7z_open_opts opts{};
  opts.size = sizeof(opts);
  opts.bridge = &br;
  std::wstring hint_w(format_hint.begin(), format_hint.end());
  if (!hint_w.empty()) opts.format_hint = hint_w.c_str();
  if (!secret.empty()) {
    opts.password_utf8 = secret.data();
    opts.password_len = static_cast<uint32_t>(secret.size());
  }

  lumina_7z_archive* ar = nullptr;
  st = host.api.open_archive(source_path.c_str(), &opts, &ar);
  if (st != LUMINA_7Z_OK) {
    emit(emit_user, "failed", std::string("{\"code\":\"") + status_code(st) + "\"}");
    host.api.shutdown();
    if (host.adapter) FreeLibrary(host.adapter);
    return 0;
  }

  char fmt[32]{};
  uint32_t n = 0;
  int64_t phy = -1;
  int32_t solid = -1, enc = -1;
  host.api.get_archive_info(ar, fmt, sizeof(fmt), &n, &phy, &solid, &enc);
  std::string info = std::string("{\"format\":") + json_escape(fmt) + ",\"item_count\":" + std::to_string(n);
  info += ",\"physical_size\":" + (phy < 0 ? std::string("null") : std::to_string(phy));
  info += ",\"solid\":" + (solid < 0 ? std::string("null") : (solid ? std::string("true") : std::string("false")));
  info += ",\"encrypted\":" + (enc < 0 ? std::string("null") : (enc ? std::string("true") : std::string("false")));
  info += "}";
  emit(emit_user, "archive_info", info);

  const uint32_t max_batch_bytes = 400 * 1024;
  uint32_t batch_index = 0;
  uint32_t first = 0;
  std::string entries = "[";
  uint32_t in_batch = 0;
  auto flush = [&]() {
    if (in_batch == 0) return;
    entries.push_back(']');
    std::string payload = std::string("{\"batch_index\":") + std::to_string(batch_index) +
                          ",\"first_entry_index\":" + std::to_string(first) + ",\"entries\":" + entries + "}";
    emit(emit_user, "entry_batch", payload);
    ++batch_index;
    entries = "[";
    in_batch = 0;
  };
  for (uint32_t i = 0; i < n; ++i) {
    if (ctx->cancel.load()) break;
    lumina_7z_entry e{};
    char path[4096]{};
    int32_t ls = host.api.list_entry(ar, i, &e, path, sizeof(path));
    if (ls == LUMINA_7Z_CANCELLED) break;
    std::string rec = std::string("{\"index\":") + std::to_string(e.index) + ",\"path\":" + json_escape(path);
    rec += ",\"is_directory\":" + std::string(e.is_directory == 1 ? "true" : (e.is_directory == 0 ? "false" : "null"));
    rec += ",\"uncompressed_size\":" + (e.uncompressed_size < 0 ? std::string("null") : std::to_string(e.uncompressed_size));
    rec += ",\"packed_size\":" + (e.packed_size < 0 ? std::string("null") : std::to_string(e.packed_size));
    rec += ",\"encrypted\":" + (e.encrypted < 0 ? std::string("null") : (e.encrypted ? std::string("true") : std::string("false")));
    rec += "}";
    if (in_batch == 0) first = i;
    if (in_batch) entries.push_back(',');
    entries += rec;
    ++in_batch;
    if (entries.size() >= max_batch_bytes) flush();
  }
  flush();

  if (ctx->cancel.load()) {
    host.api.close_archive(ar);
    host.api.shutdown();
    if (host.adapter) FreeLibrary(host.adapter);
    return 1;
  }

  st = host.api.test_archive(ar);
  host.api.close_archive(ar);
  host.api.shutdown();
  if (host.adapter) FreeLibrary(host.adapter);
  if (ctx->cancel.load() || st == LUMINA_7Z_CANCELLED) return 1;
  if (st != LUMINA_7Z_OK) {
    emit(emit_user, "failed", std::string("{\"code\":\"") + status_code(st) + "\"}");
    return 0;
  }
  emit(emit_user, "completed", std::string("{\"code\":\"OK\",\"items_tested\":") + std::to_string(n) + "}");
  return 0;
}

void wake(JobCtx* ctx) { ctx->cv.notify_all(); }

#else
int run_test_job(const std::wstring&, const std::string&, std::vector<uint8_t>&, JobCtx*, EmitFn, void*) { return 2; }
void wake(JobCtx*) {}
#endif
} // namespace lumina::engine::g3
