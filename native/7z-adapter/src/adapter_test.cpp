#include "lumina/seven_zip_abi.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

static int fail(const char* m) {
  std::fprintf(stderr, "FAIL %s\n", m);
  return 1;
}

#ifdef _WIN32
static std::wstring to_wide(const char* s) {
  if (!s) return {};
  int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, nullptr, 0);
  std::wstring w(static_cast<size_t>(n), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s, -1, w.data(), n);
  if (!w.empty() && w.back() == L'\0') w.pop_back();
  return w;
}
#endif

int main(int argc, char** argv) {
#ifndef _WIN32
  (void)argc;
  (void)argv;
  return 2;
#else
  if (argc < 3) return fail("usage: lumina-7z-adapter-test <7z.dll> <archive>");
  lumina_7z_api_v1 api{};
  api.size = sizeof(api);
  if (lumina_7z_adapter_get_api_v1(&api) != LUMINA_7Z_OK) return fail("abi");
  if (api.abi_version != LUMINA_7Z_ABI_VERSION) return fail("abi ver");
  auto dll = to_wide(argv[1]);
  auto arc = to_wide(argv[2]);
  int32_t st = api.initialize(dll.c_str());
  if (st != LUMINA_7Z_OK) {
    std::fprintf(stderr, "init status=%d\n", st);
    return 1;
  }
  lumina_7z_caps caps{};
  caps.size = sizeof(caps);
  api.capabilities(&caps);
  std::printf("backend=%s version=%s arch=%s handlers=%u 7z=%u zip=%u\n",
              caps.backend, caps.backend_version, caps.architecture,
              caps.handlers_detected, caps.verified_7z, caps.verified_zip);

  lumina_7z_open_opts opts{};
  opts.size = sizeof(opts);
  lumina_7z_archive* ar = nullptr;
  st = api.open_archive(arc.c_str(), &opts, &ar);
  std::printf("open status=%d\n", st);
  if (st != LUMINA_7Z_OK) {
    api.shutdown();
    return (st == LUMINA_7Z_NOT_ARCHIVE || st == LUMINA_7Z_PASSWORD_REQUIRED) ? 0 : 1;
  }
  char fmt[32]{};
  uint32_t n = 0;
  int64_t phy = -1;
  int32_t solid = -1, enc = -1;
  api.get_archive_info(ar, fmt, sizeof(fmt), &n, &phy, &solid, &enc);
  std::printf("format=%s items=%u phy=%lld solid=%d enc=%d\n", fmt, n, static_cast<long long>(phy), solid, enc);
  for (uint32_t i = 0; i < n && i < 8; ++i) {
    lumina_7z_entry e{};
    char path[1024]{};
    api.list_entry(ar, i, &e, path, sizeof(path));
    std::printf("entry %u dir=%d size=%lld path_len=%zu\n", e.index, e.is_directory,
                static_cast<long long>(e.uncompressed_size), std::strlen(path));
  }
  st = api.test_archive(ar);
  std::printf("test status=%d\n", st);
  api.close_archive(ar);
  api.shutdown();
  return st == LUMINA_7Z_OK ? 0 : 1;
#endif
}
