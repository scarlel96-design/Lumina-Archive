#include "framing.hpp"
#include "lumina/engine.hpp"

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

namespace lumina::ipc {

bool valid_utf8(const uint8_t* p, size_t n) {
  size_t i = 0;
  while (i < n) {
    uint8_t c = p[i];
    if (c <= 0x7F) { i++; continue; }
    int need = 0;
    uint32_t cp = 0;
    if ((c & 0xE0) == 0xC0) { need = 1; cp = c & 0x1F; if (cp < 0x02) return false; }
    else if ((c & 0xF0) == 0xE0) { need = 2; cp = c & 0x0F; }
    else if ((c & 0xF8) == 0xF0) { need = 3; cp = c & 0x07; }
    else return false;
    if (i + need >= n) return false;
    for (int k = 1; k <= need; k++) {
      if ((p[i + k] & 0xC0) != 0x80) return false;
      cp = (cp << 6) | (p[i + k] & 0x3F);
    }
    if (need == 2 && cp < 0x800) return false;
    if (need == 3 && cp < 0x10000) return false;
    if (cp >= 0xD800 && cp <= 0xDFFF) return false;
    if (cp > 0x10FFFF) return false;
    i += 1u + static_cast<size_t>(need);
  }
  return true;
}

#ifdef _WIN32
bool read_exact(void* handle, void* buf, uint32_t n) {
  auto* h = static_cast<HANDLE>(handle);
  auto* p = static_cast<char*>(buf);
  uint32_t got = 0;
  while (got < n) {
    DWORD chunk = 0;
    if (!ReadFile(h, p + got, n - got, &chunk, nullptr) || chunk == 0) return false;
    got += chunk;
  }
  return true;
}

bool write_all(void* handle, const void* buf, uint32_t n) {
  auto* h = static_cast<HANDLE>(handle);
  auto* p = static_cast<const char*>(buf);
  uint32_t sent = 0;
  while (sent < n) {
    DWORD chunk = 0;
    if (!WriteFile(h, p + sent, n - sent, &chunk, nullptr) || chunk == 0) return false;
    sent += chunk;
  }
  return true;
}
#else
bool read_exact(void*, void*, uint32_t) { return false; }
bool write_all(void*, const void*, uint32_t) { return false; }
#endif

bool read_frame(void* handle, std::string& json_out, uint32_t max_len) {
  uint8_t hdr[4];
  if (!read_exact(handle, hdr, 4)) return false;
  uint32_t len = uint32_t(hdr[0]) | (uint32_t(hdr[1]) << 8) | (uint32_t(hdr[2]) << 16) | (uint32_t(hdr[3]) << 24);
  if (len == 0 || len > max_len) return false;
  json_out.assign(len, '\0');
  if (!read_exact(handle, json_out.data(), len)) return false;
  return valid_utf8(reinterpret_cast<const uint8_t*>(json_out.data()), json_out.size());
}

bool write_frame(void* handle, const std::string& json) {
  if (json.empty() || json.size() > lumina::engine::kMaxControlFrame) return false;
  uint32_t len = static_cast<uint32_t>(json.size());
  uint8_t hdr[4] = { uint8_t(len), uint8_t(len >> 8), uint8_t(len >> 16), uint8_t(len >> 24) };
  return write_all(handle, hdr, 4) && write_all(handle, json.data(), len);
}

bool read_secret_frame(void* handle, std::vector<uint8_t>& out, uint32_t max_len) {
  uint8_t hdr[4];
  if (!read_exact(handle, hdr, 4)) return false;
  uint32_t len = uint32_t(hdr[0]) | (uint32_t(hdr[1]) << 8) | (uint32_t(hdr[2]) << 16) | (uint32_t(hdr[3]) << 24);
  if (len == 0 || len > max_len) return false;
  out.assign(len, 0);
  return read_exact(handle, out.data(), len);
}

} // namespace lumina::ipc
