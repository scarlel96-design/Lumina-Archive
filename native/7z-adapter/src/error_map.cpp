#include "internal.hpp"

namespace lumina::sevenzip {

int32_t map_hresult(HRESULT hr) {
  dll().last_hresult = static_cast<int32_t>(hr);
  if (hr == S_OK) return LUMINA_7Z_OK;
  if (hr == E_ABORT) return LUMINA_7Z_CANCELLED;
  if (hr == E_OUTOFMEMORY) return LUMINA_7Z_INTERNAL;
  if (hr == HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND) || hr == HRESULT_FROM_WIN32(ERROR_PATH_NOT_FOUND))
    return LUMINA_7Z_IO_ERROR;
  if (FAILED(HRESULT_FROM_WIN32(ERROR_ACCESS_DENIED)) && hr == HRESULT_FROM_WIN32(ERROR_ACCESS_DENIED))
    return LUMINA_7Z_IO_ERROR;
  if (hr == S_FALSE) return LUMINA_7Z_NOT_ARCHIVE;
  return LUMINA_7Z_ARCHIVE_OPEN_FAILED;
}

int32_t map_opres(Int32 op) {
  using NArchive::NExtract::NOperationResult;
  switch (op) {
    case NOperationResult::kOK: return LUMINA_7Z_OK;
    case NOperationResult::kUnsupportedMethod: return LUMINA_7Z_UNSUPPORTED_METHOD;
    case NOperationResult::kDataError: return LUMINA_7Z_DATA_ERROR;
    case NOperationResult::kCRCError: return LUMINA_7Z_CRC_ERROR;
    case NOperationResult::kUnexpectedEnd: return LUMINA_7Z_UNEXPECTED_END;
    case NOperationResult::kHeadersError: return LUMINA_7Z_HEADER_ERROR;
    case NOperationResult::kWrongPassword: return LUMINA_7Z_WRONG_PASSWORD;
    case NOperationResult::kIsNotArc: return LUMINA_7Z_NOT_ARCHIVE;
    default: return LUMINA_7Z_DATA_ERROR;
  }
}

int32_t checkpoint_bridge(Bridge* b) {
  if (!b) return LUMINA_7Z_OK;
  if (b->cb.is_cancel_requested && b->cb.is_cancel_requested(b->cb.user))
    return LUMINA_7Z_CANCELLED;
  if (b->cb.wait_if_paused) {
    if (b->cb.wait_if_paused(b->cb.user) == 0) {
      if (b->cb.is_cancel_requested && b->cb.is_cancel_requested(b->cb.user))
        return LUMINA_7Z_CANCELLED;
    }
  }
  if (b->cb.is_cancel_requested && b->cb.is_cancel_requested(b->cb.user))
    return LUMINA_7Z_CANCELLED;
  return LUMINA_7Z_OK;
}

HRESULT give_password(Bridge* b, Utf16Password* pw, BSTR* password, Int32* defined) {
  if (!password) return E_POINTER;
  *password = nullptr;
  if (b) b->password_asked.store(1);
  if (!pw || pw->empty()) {
    if (defined) *defined = 0;
    return E_ABORT;
  }
  if (b) b->had_password.store(1);
  if (defined) *defined = 1;
  *password = pw->alloc_bstr();
  return *password ? S_OK : E_OUTOFMEMORY;
}

} // namespace lumina::sevenzip
