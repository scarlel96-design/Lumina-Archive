#include "lumina/engine.hpp"

#include <cerrno>
#include <cstdlib>
#include <iostream>
#include <string>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
static void apply_worker_mitigations() {
  SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32 | LOAD_LIBRARY_SEARCH_USER_DIRS);
  PROCESS_MITIGATION_DEP_POLICY dep{};
  dep.Enable = 1;
  dep.Permanent = 1;
  SetProcessMitigationPolicy(ProcessDEPPolicy, &dep, sizeof(dep));
  PROCESS_MITIGATION_ASLR_POLICY aslr{};
  aslr.EnableBottomUpRandomization = 1;
  aslr.EnableForceRelocateImages = 1;
  aslr.EnableHighEntropy = 1;
  SetProcessMitigationPolicy(ProcessASLRPolicy, &aslr, sizeof(aslr));
  PROCESS_MITIGATION_STRICT_HANDLE_CHECK_POLICY handles{};
  handles.RaiseExceptionOnInvalidHandleReference = 1;
  handles.HandleExceptionsPermanentlyEnabled = 1;
  SetProcessMitigationPolicy(ProcessStrictHandleCheckPolicy, &handles, sizeof(handles));
  PROCESS_MITIGATION_EXTENSION_POINT_DISABLE_POLICY ext{};
  ext.DisableExtensionPoints = 1;
  SetProcessMitigationPolicy(ProcessExtensionPointDisablePolicy, &ext, sizeof(ext));
  PROCESS_MITIGATION_IMAGE_LOAD_POLICY img{};
  img.NoRemoteImages = 1;
  img.NoLowMandatoryLabelImages = 1;
  SetProcessMitigationPolicy(ProcessImageLoadPolicy, &img, sizeof(img));
  /* MicrosoftSignedOnly is NOT enabled: official 7z.dll is not a Microsoft binary. */
}
#endif

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
#ifdef _WIN32
  apply_worker_mitigations();
#endif
  return lumina::engine::run_worker(cfg);
}
