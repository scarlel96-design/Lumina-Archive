#define INITGUID
#include "internal.hpp"

using lumina::sevenzip::api_capabilities;
using lumina::sevenzip::api_close;
using lumina::sevenzip::api_info;
using lumina::sevenzip::api_initialize;
using lumina::sevenzip::api_list_entry;
using lumina::sevenzip::api_open;
using lumina::sevenzip::api_shutdown;
using lumina::sevenzip::api_test;

extern "C" LUMINA_7Z_API int32_t lumina_7z_adapter_get_api_v1(lumina_7z_api_v1* out) {
  if (!out) return LUMINA_7Z_ARG;
  if (out->size < sizeof(lumina_7z_api_v1)) return LUMINA_7Z_ADAPTER_ABI_MISMATCH;
  out->abi_version = LUMINA_7Z_ABI_VERSION;
  out->initialize = api_initialize;
  out->shutdown = api_shutdown;
  out->capabilities = api_capabilities;
  out->open_archive = api_open;
  out->get_archive_info = api_info;
  out->list_entry = api_list_entry;
  out->test_archive = api_test;
  out->close_archive = api_close;
  out->size = sizeof(lumina_7z_api_v1);
  return LUMINA_7Z_OK;
}
