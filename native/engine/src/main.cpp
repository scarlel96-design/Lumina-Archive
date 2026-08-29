#include "lumina/engine.hpp"

#include <cerrno>
#include <cstdlib>
#include <iostream>
#include <string>

// Invariant: never read passwords from argv or environment.
static bool eq(const char* a, const char* b) { return std::string(a) == b; }

static bool parse_protocol_version(const char* s, int* out) {
  if (!s || !*s) return false;
  errno = 0;
  char* end = nullptr;
  long v = std::strtol(s, &end, 10);
  if (errno != 0 || end == s || *end != '\0') return false;
  if (v != lumina::engine::kProtocolVersion) return false;
  *out = static_cast<int>(v);
  return true;
}

int main(int argc, char** argv) {
  lumina::engine::WorkerConfig cfg;
  for (int i = 1; i < argc; ++i) {
    const char* a = argv[i];
    if (eq(a, "--job-id") && i + 1 < argc) {
      cfg.job_id = argv[++i];
    } else if (eq(a, "--protocol-version") && i + 1 < argc) {
      if (!parse_protocol_version(argv[++i], &cfg.protocol_version)) {
        std::cerr << "lumina-engine G2 bootstrap failed (no secret argv path)\n";
        return 2;
      }
    } else if (eq(a, "--control-pipe") && i + 1 < argc) {
      std::string p = argv[++i];
      cfg.control_pipe.assign(p.begin(), p.end());
    } else if (eq(a, "--secret-pipe") && i + 1 < argc) {
      std::string p = argv[++i];
      cfg.secret_pipe.assign(p.begin(), p.end());
    } else {
      std::cerr << "unknown argument\n";
      return 2;
    }
  }
  if (cfg.job_id.empty() || cfg.control_pipe.empty() || cfg.protocol_version != lumina::engine::kProtocolVersion) {
    std::cerr << "lumina-engine G2 bootstrap failed (no secret argv path)\n";
    return 2;
  }
  return lumina::engine::run_worker(cfg);
}
