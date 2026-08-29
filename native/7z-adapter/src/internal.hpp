#pragma once

#ifndef _WIN32
#error "lumina-7z-adapter is Windows-only"
#endif

#define WIN32_LEAN_AND_MEAN
#ifndef NOMINMAX
#define NOMINMAX
#endif

#include <windows.h>
#include <objbase.h>
#include <oleauto.h>
#include <propidl.h>

#include <atomic>
#include <cstdint>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

#include "lumina/seven_zip_abi.h"

#ifdef _MSC_VER
#pragma warning(push)
#pragma warning(disable : 4100 4127 4514 4668 4865 5204)
#endif
#include "CPP/7zip/Archive/IArchive.h"
#include "CPP/7zip/IPassword.h"
#ifdef _MSC_VER
#pragma warning(pop)
#endif

namespace lumina::sevenzip {

/* 7-Zip interface methods use Z7_COM7F_E == throw(). Match that spec. */
#if defined(_MSC_VER)
#define L7Z_THROW throw()
#else
#define L7Z_THROW
#endif

inline constexpr uint32_t kSeekSet = 0;
inline constexpr uint32_t kSeekCur = 1;
inline constexpr uint32_t kSeekEnd = 2;

struct DllState {
  HMODULE module = nullptr;
  Func_CreateObject create_object = nullptr;
  Func_GetNumberOfFormats get_number_of_formats = nullptr;
  Func_GetHandlerProperty2 get_handler_property2 = nullptr;
  std::wstring path;
  std::string arch;
  uint32_t handlers = 0;
  bool has_7z = false;
  bool has_zip = false;
  int32_t last_hresult = 0;
};

struct Handler {
  GUID clsid{};
  std::string name;
  std::string ext;
  bool update = false;
};

struct Bridge {
  lumina_7z_bridge cb{};
  std::atomic<int32_t> last_op_res{0};
  std::atomic<int32_t> password_asked{0};
  std::atomic<int32_t> had_password{0};
  std::atomic<uint64_t> progress_done{0};
  std::atomic<int64_t> progress_total{-1};
};

class Utf16Password {
 public:
  ~Utf16Password() { wipe(); }
  int32_t set_utf8(const uint8_t* bytes, uint32_t len);
  BSTR alloc_bstr() const; /* caller/7-Zip owns the BSTR */
  bool empty() const { return w_.empty(); }
  void wipe();

 private:
  std::vector<wchar_t> w_;
};

class FileInStream final : public IInStream {
 public:
  explicit FileInStream(HANDLE h) : h_(h) {}
  FileInStream(const FileInStream&) = delete;
  FileInStream& operator=(const FileInStream&) = delete;
  virtual ~FileInStream();

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** pp) override;
  ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
  ULONG STDMETHODCALLTYPE Release() override;
  HRESULT STDMETHODCALLTYPE Read(void* data, UInt32 size, UInt32* processed) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE Seek(Int64 offset, UInt32 seekOrigin, UInt64* newPosition) L7Z_THROW override;

  static int32_t open_abs(const wchar_t* path, FileInStream** out);

 private:
  void close_handle();
  std::atomic<ULONG> refs_{1};
  HANDLE h_ = INVALID_HANDLE_VALUE;
};

class OpenCallback final : public IArchiveOpenCallback, public ICryptoGetTextPassword, public ICryptoGetTextPassword2 {
 public:
  OpenCallback(Bridge* bridge, Utf16Password* pw) : bridge_(bridge), pw_(pw) {}
  virtual ~OpenCallback() = default;

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** pp) override;
  ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
  ULONG STDMETHODCALLTYPE Release() override {
    ULONG n = --refs_;
    if (n == 0) delete this;
    return n;
  }
  HRESULT STDMETHODCALLTYPE SetTotal(const UInt64* files, const UInt64* bytes) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE SetCompleted(const UInt64* files, const UInt64* bytes) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE CryptoGetTextPassword(BSTR* password) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE CryptoGetTextPassword2(Int32* defined, BSTR* password) L7Z_THROW override;

 private:
  std::atomic<ULONG> refs_{1};
  Bridge* bridge_;
  Utf16Password* pw_;
};

class ExtractTestCallback final : public IArchiveExtractCallback, public ICryptoGetTextPassword, public ICryptoGetTextPassword2 {
 public:
  ExtractTestCallback(Bridge* bridge, Utf16Password* pw, UInt32 total_items)
      : bridge_(bridge), pw_(pw), total_items_(total_items) {}
  virtual ~ExtractTestCallback() = default;

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** pp) override;
  ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
  ULONG STDMETHODCALLTYPE Release() override {
    ULONG n = --refs_;
    if (n == 0) delete this;
    return n;
  }
  HRESULT STDMETHODCALLTYPE SetTotal(UInt64 total) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE SetCompleted(const UInt64* completeValue) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE GetStream(UInt32 index, ISequentialOutStream** outStream, Int32 askExtractMode) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE PrepareOperation(Int32 askExtractMode) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE SetOperationResult(Int32 opRes) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE CryptoGetTextPassword(BSTR* password) L7Z_THROW override;
  HRESULT STDMETHODCALLTYPE CryptoGetTextPassword2(Int32* defined, BSTR* password) L7Z_THROW override;

  int32_t worst_result() const { return worst_; }

 private:
  HRESULT checkpoint();
  std::atomic<ULONG> refs_{1};
  Bridge* bridge_;
  Utf16Password* pw_;
  UInt32 total_items_ = 0;
  UInt32 done_items_ = 0;
  int32_t worst_ = NArchive::NExtract::NOperationResult::kOK;
  ULONGLONG last_progress_tick_ = 0;
};

struct Archive {
  IInArchive* in = nullptr;
  FileInStream* stream = nullptr;
  Bridge bridge{};
  Utf16Password password;
  std::string format;
  GUID handler{};
  uint32_t items = 0;
};

DllState& dll();
int32_t load_official_dll(const wchar_t* abs_path);
void unload_official_dll();
int32_t enumerate_handlers(std::vector<Handler>& out);
int32_t map_hresult(HRESULT hr);
int32_t map_opres(Int32 op);
int32_t pe_machine(const wchar_t* path, uint16_t* machine);
const char* host_arch_name();
uint16_t host_pe_machine();
int32_t checkpoint_bridge(Bridge* b);
HRESULT give_password(Bridge* b, Utf16Password* pw, BSTR* password, Int32* defined);
std::string wide_to_utf8(const wchar_t* s, int nchars = -1);
int32_t utf8_to_wide(const uint8_t* bytes, uint32_t len, std::vector<wchar_t>& out);
void secure_wipe(void* p, size_t n);
int32_t prop_to_i64(const PROPVARIANT& p, int64_t* out);
int32_t prop_to_bool(const PROPVARIANT& p, int32_t* out);
std::string prop_bstr_utf8(const PROPVARIANT& p);
void clear_prop(PROPVARIANT& p);

int32_t api_initialize(const wchar_t* path);
int32_t api_shutdown();
int32_t api_capabilities(lumina_7z_caps* out);
int32_t api_open(const wchar_t* path, const lumina_7z_open_opts* opts, lumina_7z_archive** out);
int32_t api_info(lumina_7z_archive* a, char* format, uint32_t format_cap, uint32_t* item_count, int64_t* phy_size, int32_t* solid, int32_t* encrypted);
int32_t api_list_entry(lumina_7z_archive* a, uint32_t index, lumina_7z_entry* out, char* path_utf8, uint32_t path_cap);
int32_t api_test(lumina_7z_archive* a);
int32_t api_close(lumina_7z_archive* a);

} // namespace lumina::sevenzip
