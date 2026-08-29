// G1 bench-only process launcher. Not a product binary. No archive parsers.
#define UNICODE
#define _UNICODE
#define NOMINMAX
#include <windows.h>
#include <psapi.h>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>


#pragma comment(lib, "psapi.lib")

static bool writeUtf8(const std::wstring &path, const std::string &body) {
  FILE *f = nullptr;
  if (_wfopen_s(&f, path.c_str(), L"wb") != 0 || !f) return false;
  fwrite(body.data(), 1, body.size(), f);
  fclose(f);
  return true;
}

int wmain(int argc, wchar_t **argv) {
  std::wstring telemetry;
  std::wstring cwd;
  DWORD_PTR mask = 0;
  int dash = -1;
  for (int i = 1; i < argc; ++i) {
    std::wstring a = argv[i];
    if (a == L"--") {
      dash = i;
      break;
    }
    if (a.rfind(L"--telemetry=", 0) == 0) telemetry = a.substr(12);
    else if (a.rfind(L"--cwd=", 0) == 0) cwd = a.substr(6);
    else if (a.rfind(L"--affinity-mask=", 0) == 0) {
      mask = static_cast<DWORD_PTR>(wcstoull(a.c_str() + 16, nullptr, 0));
    }
  }
  if (dash < 0 || dash + 1 >= argc || telemetry.empty()) {
    fwprintf(stderr, L"lumina-bench-run --telemetry=file --cwd=dir --affinity-mask=0xN -- child...\n");
    return 2;
  }

  std::wstring cmd;
  for (int i = dash + 1; i < argc; ++i) {
    if (!cmd.empty()) cmd.push_back(L' ');
    cmd.push_back(L'"');
    cmd += argv[i];
    cmd.push_back(L'"');
  }

  STARTUPINFOW si{};
  si.cb = sizeof(si);
  PROCESS_INFORMATION pi{};
  DWORD flags = CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT;
  std::vector<wchar_t> buf(cmd.begin(), cmd.end());
  buf.push_back(0);
  const wchar_t *dir = cwd.empty() ? nullptr : cwd.c_str();
  if (!CreateProcessW(nullptr, buf.data(), nullptr, nullptr, FALSE, flags, nullptr, dir, &si, &pi)) {
    return 3;
  }
  if (mask) SetProcessAffinityMask(pi.hProcess, mask);
  LARGE_INTEGER q1, q2, freq;
  QueryPerformanceFrequency(&freq);
  QueryPerformanceCounter(&q1);
  ResumeThread(pi.hThread);
  WaitForSingleObject(pi.hProcess, INFINITE);
  QueryPerformanceCounter(&q2);
  DWORD exitCode = 1;
  GetExitCodeProcess(pi.hProcess, &exitCode);

  FILETIME c, e, k, u;
  GetProcessTimes(pi.hProcess, &c, &e, &k, &u);
  auto ft100ns = [](FILETIME t) -> unsigned long long {
    ULARGE_INTEGER x;
    x.LowPart = t.dwLowDateTime;
    x.HighPart = t.dwHighDateTime;
    return x.QuadPart;
  };
  double userMs = ft100ns(u) / 10000.0;
  double kernelMs = ft100ns(k) / 10000.0;
  double wallMs = (q2.QuadPart - q1.QuadPart) * 1000.0 / freq.QuadPart;

  PROCESS_MEMORY_COUNTERS_EX pmc{};
  pmc.cb = sizeof(pmc);
  GetProcessMemoryInfo(pi.hProcess, reinterpret_cast<PROCESS_MEMORY_COUNTERS *>(&pmc), sizeof(pmc));
  IO_COUNTERS io{};
  GetProcessIoCounters(pi.hProcess, &io);

  char json[2048];
  snprintf(json, sizeof(json),
           "{\"wall_ms\":%.3f,\"cpu_ms\":%.3f,\"cpu_user_ms\":%.3f,\"cpu_kernel_ms\":%.3f,"
           "\"peak_wss_bytes\":%llu,\"peak_private_bytes\":%llu,"
           "\"read_ops\":%llu,\"write_ops\":%llu,\"read_bytes\":%llu,\"write_bytes\":%llu,"
           "\"exitCode\":%lu,\"affinityMask\":\"0x%llx\",\"unsupportedReason\":null}\n",
           wallMs, userMs + kernelMs, userMs, kernelMs,
           static_cast<unsigned long long>(pmc.PeakWorkingSetSize),
           static_cast<unsigned long long>(pmc.PrivateUsage),
           static_cast<unsigned long long>(io.ReadOperationCount),
           static_cast<unsigned long long>(io.WriteOperationCount),
           static_cast<unsigned long long>(io.ReadTransferCount),
           static_cast<unsigned long long>(io.WriteTransferCount),
           exitCode, static_cast<unsigned long long>(mask));
  writeUtf8(telemetry, json);
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  return static_cast<int>(exitCode);
}
