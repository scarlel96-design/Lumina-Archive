#pragma once
/* Versioned C ABI between lumina-engine.exe and lumina-7z-adapter.dll.
 * No C++ types, no STL, no exceptions across this boundary. */

#include <stddef.h>
#include <stdint.h>

#ifdef _WIN32
#ifdef LUMINA_7Z_ADAPTER_EXPORTS
#define LUMINA_7Z_API __declspec(dllexport)
#else
#define LUMINA_7Z_API __declspec(dllimport)
#endif
#else
#define LUMINA_7Z_API
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define LUMINA_7Z_ABI_VERSION 1u
#define LUMINA_7Z_PATH_MAX 32768u

typedef enum lumina_7z_status {
  LUMINA_7Z_OK = 0,
  LUMINA_7Z_DLL_NOT_FOUND = 1,
  LUMINA_7Z_DLL_ARCH_MISMATCH = 2,
  LUMINA_7Z_REQUIRED_EXPORT_MISSING = 3,
  LUMINA_7Z_ADAPTER_ABI_MISMATCH = 4,
  LUMINA_7Z_HANDLER_NOT_FOUND = 5,
  LUMINA_7Z_ARCHIVE_OPEN_FAILED = 6,
  LUMINA_7Z_NOT_ARCHIVE = 7,
  LUMINA_7Z_HEADER_ERROR = 8,
  LUMINA_7Z_PASSWORD_REQUIRED = 9,
  LUMINA_7Z_WRONG_PASSWORD = 10,
  LUMINA_7Z_UNSUPPORTED_METHOD = 11,
  LUMINA_7Z_DATA_ERROR = 12,
  LUMINA_7Z_CRC_ERROR = 13,
  LUMINA_7Z_UNEXPECTED_END = 14,
  LUMINA_7Z_IO_ERROR = 15,
  LUMINA_7Z_CANCELLED = 16,
  LUMINA_7Z_PROTOCOL_BRIDGE = 17,
  LUMINA_7Z_INVALID_UTF8 = 18,
  LUMINA_7Z_BACKEND_UNAVAILABLE = 19,
  LUMINA_7Z_BACKEND_INCOMPATIBLE = 20,
  LUMINA_7Z_ARG = 21,
  LUMINA_7Z_INTERNAL = 22
} lumina_7z_status;

typedef struct lumina_7z_caps {
  uint32_t size;
  uint32_t abi_version;
  char backend[16];
  char backend_version[16];
  char architecture[16];
  uint32_t handlers_detected;
  uint32_t verified_7z;
  uint32_t verified_zip;
  int32_t last_status;
  int32_t last_hresult;
} lumina_7z_caps;

typedef struct lumina_7z_entry {
  uint32_t index;
  int32_t is_directory; /* -1 unknown */
  int64_t uncompressed_size; /* -1 unknown */
  int64_t packed_size; /* -1 unknown */
  int32_t crc_defined;
  uint32_t crc;
  int32_t encrypted; /* -1 unknown */
  int32_t attrib_defined;
  uint32_t attrib;
} lumina_7z_entry;

typedef struct lumina_7z_bridge {
  uint32_t size;
  void* user;
  int32_t (*is_cancel_requested)(void* user);
  int32_t (*wait_if_paused)(void* user);
  int32_t (*report_progress)(void* user, uint64_t done, int64_t total, uint32_t entries_done, uint32_t entries_total, const char* phase);
} lumina_7z_bridge;

typedef struct lumina_7z_open_opts {
  uint32_t size;
  const wchar_t* format_hint; /* nullable */
  const uint8_t* password_utf8; /* nullable, not logged */
  uint32_t password_len;
  const lumina_7z_bridge* bridge;
} lumina_7z_open_opts;

typedef struct lumina_7z_archive lumina_7z_archive;

typedef struct lumina_7z_api_v1 {
  uint32_t size;
  uint32_t abi_version;
  int32_t (*initialize)(const wchar_t* seven_zip_dll_abs_path);
  int32_t (*shutdown)(void);
  int32_t (*capabilities)(lumina_7z_caps* out);
  int32_t (*open_archive)(const wchar_t* abs_path, const lumina_7z_open_opts* opts, lumina_7z_archive** out);
  int32_t (*get_archive_info)(lumina_7z_archive* a, char* format, uint32_t format_cap, uint32_t* item_count, int64_t* phy_size, int32_t* solid, int32_t* encrypted);
  int32_t (*list_entry)(lumina_7z_archive* a, uint32_t index, lumina_7z_entry* out, char* path_utf8, uint32_t path_cap);
  int32_t (*test_archive)(lumina_7z_archive* a);
  int32_t (*close_archive)(lumina_7z_archive* a);
} lumina_7z_api_v1;

LUMINA_7Z_API int32_t lumina_7z_adapter_get_api_v1(lumina_7z_api_v1* out);

#ifdef __cplusplus
}
#endif
