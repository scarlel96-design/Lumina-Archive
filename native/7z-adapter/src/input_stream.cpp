#include "internal.hpp"
#include <new>

namespace lumina::sevenzip {

void FileInStream::close_handle() {
  if (h_ && h_ != INVALID_HANDLE_VALUE) {
    CloseHandle(h_);
    h_ = INVALID_HANDLE_VALUE;
  }
}

FileInStream::~FileInStream() { close_handle(); }

HRESULT STDMETHODCALLTYPE FileInStream::QueryInterface(REFIID iid, void** pp) {
  if (!pp) return E_POINTER;
  *pp = nullptr;
  if (iid == IID_IUnknown || iid == IID_ISequentialInStream || iid == IID_IInStream) {
    *pp = static_cast<IInStream*>(this);
    AddRef();
    return S_OK;
  }
  return E_NOINTERFACE;
}

ULONG STDMETHODCALLTYPE FileInStream::Release() {
  ULONG n = --refs_;
  if (n == 0) delete this;
  return n;
}

HRESULT STDMETHODCALLTYPE FileInStream::Read(void* data, UInt32 size, UInt32* processed) L7Z_THROW {
  try {
    if (processed) *processed = 0;
    if (size == 0) return S_OK;
    if (!data) return E_POINTER;
    DWORD n = 0;
    if (!ReadFile(h_, data, size, &n, nullptr)) return HRESULT_FROM_WIN32(GetLastError());
    if (processed) *processed = n;
    return S_OK;
  } catch (...) {
    return E_FAIL;
  }
}

HRESULT STDMETHODCALLTYPE FileInStream::Seek(Int64 offset, UInt32 seekOrigin, UInt64* newPosition) L7Z_THROW {
  try {
    DWORD method = FILE_BEGIN;
    if (seekOrigin == kSeekCur) method = FILE_CURRENT;
    else if (seekOrigin == kSeekEnd) method = FILE_END;
    else if (seekOrigin != kSeekSet) return STG_E_INVALIDFUNCTION;
    LARGE_INTEGER d;
    d.QuadPart = offset;
    LARGE_INTEGER o{};
    if (!SetFilePointerEx(h_, d, &o, method)) return HRESULT_FROM_WIN32(GetLastError());
    if (newPosition) *newPosition = static_cast<UInt64>(o.QuadPart);
    return S_OK;
  } catch (...) {
    return E_FAIL;
  }
}

int32_t FileInStream::open_abs(const wchar_t* path, FileInStream** out) {
  if (!path || !out) return LUMINA_7Z_ARG;
  *out = nullptr;
  HANDLE h = CreateFileW(
      path,
      GENERIC_READ,
      FILE_SHARE_READ | FILE_SHARE_DELETE,
      nullptr,
      OPEN_EXISTING,
      FILE_ATTRIBUTE_NORMAL | FILE_FLAG_SEQUENTIAL_SCAN,
      nullptr);
  if (h == INVALID_HANDLE_VALUE) return LUMINA_7Z_IO_ERROR;
  auto* s = new (std::nothrow) FileInStream(h);
  if (!s) {
    CloseHandle(h);
    return LUMINA_7Z_INTERNAL;
  }
  *out = s;
  return LUMINA_7Z_OK;
}

} // namespace lumina::sevenzip
