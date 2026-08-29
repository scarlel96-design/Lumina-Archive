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

enum HelperCode {
  kHelperUsage = 2,
  kHelperCreate = 3,
  kHelperAffinity = 4,
  kHelperQpc = 5,
  kHelperWait = 6,
  kHelperExitCode = 7,
  kHelperTopology = 8,
  kHelperTelemetry = 9
};

static bool writeUtf8(const std::wstring &path, const std::string &body) {
  FILE *f = nullptr;
  if (_wfopen_s(&f, path.c_str(), L"wb") != 0 || !f) return false;
  fwrite(body.data(), 1, body.size(), f);
  fclose(f);
  return true;
}

static void appendNum(std::string &j, const char *k, bool ok, double v, bool last) {
  j += "\"";
  j += k;
  j += "\":";
  if (!ok) j += "null";
  else {
    char b[64];
    snprintf(b, sizeof(b), "%.3f", v);
    j += b;
  }
  if (!last) j += ",";
}

static void appendUll(std::string &j, const char *k, bool ok, unsigned long long v, bool last) {
  j += "\"";
  j += k;
  j += "\":";
  if (!ok) j += "null";
  else {
    char b[64];
    snprintf(b, sizeof(b), "%llu", v);
    j += b;
  }
  if (!last) j += ",";
}

static void appendBool(std::string &j, const char *k, bool v, bool last) {
  j += "\"";
  j += k;
  j += "\":";
  j += v ? "true" : "false";
  if (!last) j += ",";
}

static void appendStr(std::string &j, const char *k, const char *v, bool last) {
  j += "\"";
  j += k;
  j += "\":";
  if (!v) j += "null";
  else {
    j += "\"";
    j += v;
    j += "\"";
  }
  if (!last) j += ",";
}

static std::string buildJson(bool launcher_ok, bool child_started, bool affinity_applied,
                             DWORD_PTR mask, DWORD helperErr, const char *helperError,
                             bool wall_ok, double wall_ms, bool cpu_ok, double user_ms, double kernel_ms,
                             bool mem_ok, unsigned long long peak_wss, unsigned long long private_at_exit,
                             bool io_ok, unsigned long long ro, unsigned long long wo, unsigned long long rb,
                             unsigned long long wb, bool exit_ok, DWORD exitCode, const char *errorsJson) {
  std::string j = "{";
  appendBool(j, "launcher_ok", launcher_ok, false);
  appendBool(j, "child_started", child_started, false);
  appendBool(j, "affinity_applied", affinity_applied, false);
  appendBool(j, "affinity_requested", mask != 0, false);
  char maskHex[32];
  snprintf(maskHex, sizeof(maskHex), "0x%llx", static_cast<unsigned long long>(mask));
  appendStr(j, "affinityMask", maskHex, false);
  appendUll(j, "helper_error_code", helperErr != 0, helperErr, false);
  appendStr(j, "helper_error", helperError, false);
  appendNum(j, "wall_ms", wall_ok, wall_ms, false);
  appendNum(j, "cpu_user_ms", cpu_ok, user_ms, false);
  appendNum(j, "cpu_kernel_ms", cpu_ok, kernel_ms, false);
  appendNum(j, "cpu_ms", cpu_ok, user_ms + kernel_ms, false);
  appendUll(j, "peak_wss_bytes", mem_ok, peak_wss, false);
  j += "\"peak_private_bytes\":null,";
  appendUll(j, "private_usage_bytes_at_exit", mem_ok, private_at_exit, false);
  appendUll(j, "read_ops", io_ok, ro, false);
  appendUll(j, "write_ops", io_ok, wo, false);
  appendUll(j, "read_bytes", io_ok, rb, false);
  appendUll(j, "write_bytes", io_ok, wb, false);
  appendUll(j, "exitCode", exit_ok, exitCode, false);
  j += "\"telemetryErrors\":";
  j += errorsJson ? errorsJson : "[]";
  j += "}\n";
  return j;
}

static int fail(const std::wstring &path, int code, const char *err, DWORD win32, DWORD_PTR mask,
                bool child_started) {
  char errors[256];
  snprintf(errors, sizeof(errors), "[{\"api\":\"%s\",\"win32Error\":%lu}]", err ? err : "helper", win32);
  auto j = buildJson(false, child_started, false, mask, win32, err, false, 0, false, 0, 0, false, 0, 0,
                     false, 0, 0, 0, 0, false, 0, errors);
  writeUtf8(path, j);
  return code;
}

static void killSuspended(HANDLE proc) {
  if (proc) {
    TerminateProcess(proc, 1);
    WaitForSingleObject(proc, 2000);
  }
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
    return kHelperUsage;
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
    return fail(telemetry, kHelperCreate, "CreateProcessW", GetLastError(), mask, false);
  }

  if (GetActiveProcessorGroupCount() > 1) {
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperTopology, "GetActiveProcessorGroupCount", ERROR_NOT_SUPPORTED, mask, false);
  }

  DWORD_PTR procMask = 0, sysMask = 0;
  if (!GetProcessAffinityMask(pi.hProcess, &procMask, &sysMask)) {
    DWORD e = GetLastError();
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperAffinity, "GetProcessAffinityMask", e, mask, false);
  }
  if (mask == 0 || (mask & procMask) != mask) {
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperAffinity, "affinity_mask_incompatible", ERROR_INVALID_PARAMETER, mask, false);
  }
  if (!SetProcessAffinityMask(pi.hProcess, mask)) {
    DWORD e = GetLastError();
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperAffinity, "SetProcessAffinityMask", e, mask, false);
  }
  DWORD_PTR applied = 0, sys2 = 0;
  if (!GetProcessAffinityMask(pi.hProcess, &applied, &sys2) || applied != mask) {
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperAffinity, "affinity_verify", GetLastError(), mask, false);
  }

  LARGE_INTEGER freq{}, q1{}, q2{};
  if (!QueryPerformanceFrequency(&freq) || freq.QuadPart == 0) {
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperQpc, "QueryPerformanceFrequency", GetLastError(), mask, false);
  }
  if (!QueryPerformanceCounter(&q1)) {
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperQpc, "QueryPerformanceCounter", GetLastError(), mask, false);
  }
  if (ResumeThread(pi.hThread) == static_cast<DWORD>(-1)) {
    DWORD e = GetLastError();
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperCreate, "ResumeThread", e, mask, false);
  }

  DWORD wait = WaitForSingleObject(pi.hProcess, INFINITE);
  if (wait != WAIT_OBJECT_0) {
    DWORD e = GetLastError();
    killSuspended(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperWait, "WaitForSingleObject", e, mask, true);
  }
  bool wall_ok = QueryPerformanceCounter(&q2) != 0;
  double wall_ms = wall_ok ? (q2.QuadPart - q1.QuadPart) * 1000.0 / freq.QuadPart : 0;

  DWORD exitCode = 0;
  bool exit_ok = GetExitCodeProcess(pi.hProcess, &exitCode) != 0;
  if (!exit_ok) {
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperExitCode, "GetExitCodeProcess", GetLastError(), mask, true);
  }
  if (!wall_ok) {
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return fail(telemetry, kHelperQpc, "QueryPerformanceCounter_end", GetLastError(), mask, true);
  }

  FILETIME c{}, e{}, k{}, u{};
  DWORD cpuErr = 0, memErr = 0, ioErr = 0;
  bool cpu_ok = GetProcessTimes(pi.hProcess, &c, &e, &k, &u) != 0;
  if (!cpu_ok) cpuErr = GetLastError();
  auto ft100ns = [](FILETIME t) -> double {
    ULARGE_INTEGER x;
    x.LowPart = t.dwLowDateTime;
    x.HighPart = t.dwHighDateTime;
    return x.QuadPart / 10000.0;
  };
  double userMs = cpu_ok ? ft100ns(u) : 0;
  double kernelMs = cpu_ok ? ft100ns(k) : 0;

  PROCESS_MEMORY_COUNTERS_EX pmc{};
  pmc.cb = sizeof(pmc);
  bool mem_ok = GetProcessMemoryInfo(pi.hProcess, reinterpret_cast<PROCESS_MEMORY_COUNTERS *>(&pmc), sizeof(pmc)) != 0;
  if (!mem_ok) memErr = GetLastError();
  IO_COUNTERS io{};
  bool io_ok = GetProcessIoCounters(pi.hProcess, &io) != 0;
  if (!io_ok) ioErr = GetLastError();

  std::string errors = "[";
  bool firstErr = true;
  auto addErr = [&](bool ok, const char *api, DWORD err) {
    if (ok) return;
    if (!firstErr) errors += ",";
    firstErr = false;
    char b[160];
    snprintf(b, sizeof(b), "{\"api\":\"%s\",\"win32Error\":%lu}", api, err);
    errors += b;
  };
  addErr(cpu_ok, "GetProcessTimes", cpuErr);
  addErr(mem_ok, "GetProcessMemoryInfo", memErr);
  addErr(io_ok, "GetProcessIoCounters", ioErr);
  errors += "]";


  auto json = buildJson(true, true, true, mask, 0, nullptr, true, wall_ms, cpu_ok, userMs, kernelMs, mem_ok,
                        pmc.PeakWorkingSetSize, pmc.PrivateUsage, io_ok, io.ReadOperationCount, io.WriteOperationCount,
                        io.ReadTransferCount, io.WriteTransferCount, true, exitCode, errors.c_str());
  if (!writeUtf8(telemetry, json)) {
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return kHelperTelemetry;
  }
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  return static_cast<int>(exitCode);
}
