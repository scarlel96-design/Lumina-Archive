#include "internal.hpp"

#include <algorithm>
#include <cstring>
#include <new>

namespace lumina::sevenzip {
namespace {

template <class F>
int32_t guard(F&& f) {
  try {
    return f();
  } catch (...) {
    return LUMINA_7Z_INTERNAL;
  }
}

bool name_is(const Handler& h, const char* n) {
  return _stricmp(h.name.c_str(), n) == 0;
}

bool ext_matches(const Handler& h, const wchar_t* path) {
  if (!path || h.ext.empty()) return false;
  const wchar_t* dot = wcsrchr(path, L'.');
  if (!dot || !dot[1]) return false;
  std::string e = wide_to_utf8(dot + 1);
  std::string list = h.ext;
  std::string cur;
  for (size_t i = 0; i <= list.size(); ++i) {
    char c = i < list.size() ? list[i] : ' ';
    if (c == ' ' || c == '/' || i == list.size()) {
      if (!cur.empty() && _stricmp(cur.c_str(), e.c_str()) == 0) return true;
      cur.clear();
    } else {
      cur.push_back(c);
    }
  }
  return false;
}

int32_t try_open_handler(Archive* a, const Handler& h) {
  IInArchive* in = nullptr;
  HRESULT hr = dll().create_object(&h.clsid, &IID_IInArchive, reinterpret_cast<void**>(&in));
  if (hr != S_OK || !in) return LUMINA_7Z_HANDLER_NOT_FOUND;
  UInt64 maxCheck = 1ull << 22;
  auto* cb = new (std::nothrow) OpenCallback(&a->bridge, &a->password);
  if (!cb) {
    in->Release();
    return LUMINA_7Z_INTERNAL;
  }
  a->stream->Seek(0, kSeekSet, nullptr);
  hr = in->Open(a->stream, &maxCheck, cb);
  cb->Release();
  if (hr != S_OK) {
    in->Close();
    in->Release();
    if (a->bridge.password_asked.load() && !a->bridge.had_password.load())
      return LUMINA_7Z_PASSWORD_REQUIRED;
    if (a->bridge.had_password.load()) return LUMINA_7Z_WRONG_PASSWORD;
    if (hr == S_FALSE) return LUMINA_7Z_NOT_ARCHIVE;
    return map_hresult(hr);
  }
  a->in = in;
  a->format = h.name;
  a->handler = h.clsid;
  UInt32 n = 0;
  if (in->GetNumberOfItems(&n) == S_OK) a->items = n;
  return LUMINA_7Z_OK;
}

} // namespace

int32_t api_initialize(const wchar_t* path) {
  return guard([&] { return load_official_dll(path); });
}

int32_t api_shutdown() {
  return guard([] {
    unload_official_dll();
    return LUMINA_7Z_OK;
  });
}

int32_t api_capabilities(lumina_7z_caps* out) {
  return guard([&]() -> int32_t {
    if (!out || out->size < sizeof(lumina_7z_caps)) return LUMINA_7Z_ADAPTER_ABI_MISMATCH;
    std::memset(out, 0, sizeof(*out));
    out->size = sizeof(lumina_7z_caps);
    out->abi_version = LUMINA_7Z_ABI_VERSION;
    std::strncpy(out->backend, "7zip", sizeof(out->backend) - 1);
    std::strncpy(out->backend_version, "26.02", sizeof(out->backend_version) - 1);
    std::strncpy(out->architecture, host_arch_name(), sizeof(out->architecture) - 1);
    out->handlers_detected = dll().handlers;
    out->verified_7z = dll().has_7z ? 1 : 0;
    out->verified_zip = dll().has_zip ? 1 : 0;
    out->last_hresult = dll().last_hresult;
    return dll().module ? LUMINA_7Z_OK : LUMINA_7Z_BACKEND_UNAVAILABLE;
  });
}

int32_t api_open(const wchar_t* path, const lumina_7z_open_opts* opts, lumina_7z_archive** out) {
  return guard([&]() -> int32_t {
    if (!out) return LUMINA_7Z_ARG;
    *out = nullptr;
    if (!dll().module) return LUMINA_7Z_BACKEND_UNAVAILABLE;
    if (!path) return LUMINA_7Z_ARG;
    auto* a = new (std::nothrow) Archive();
    if (!a) return LUMINA_7Z_INTERNAL;
    if (opts) {
      if (opts->size < sizeof(lumina_7z_open_opts)) {
        delete a;
        return LUMINA_7Z_ADAPTER_ABI_MISMATCH;
      }
      if (opts->bridge && opts->bridge->size >= sizeof(lumina_7z_bridge))
        a->bridge.cb = *opts->bridge;
      if (opts->password_utf8 && opts->password_len) {
        int32_t st = a->password.set_utf8(opts->password_utf8, opts->password_len);
        if (st != LUMINA_7Z_OK) {
          delete a;
          return st;
        }
      }
    }
    FileInStream* stream = nullptr;
    int32_t st = FileInStream::open_abs(path, &stream);
    if (st != LUMINA_7Z_OK) {
      delete a;
      return st;
    }
    a->stream = stream;

    std::vector<Handler> handlers;
    enumerate_handlers(handlers);
    std::vector<Handler> order;
    const wchar_t* hint = opts ? opts->format_hint : nullptr;
    auto take = [&](const char* name) {
      for (const auto& h : handlers)
        if (name_is(h, name)) order.push_back(h);
    };
    if (hint && hint[0]) {
      std::string hs = wide_to_utf8(hint);
      for (const auto& h : handlers)
        if (name_is(h, hs.c_str())) order.push_back(h);
    }
    for (const auto& h : handlers)
      if (ext_matches(h, path)) order.push_back(h);
    take("7z");
    take("zip");

    std::vector<Handler> uniq;
    for (const auto& h : order) {
      bool seen = false;
      for (const auto& u : uniq)
        if (memcmp(&u.clsid, &h.clsid, sizeof(GUID)) == 0) seen = true;
      if (!seen) uniq.push_back(h);
    }

    int32_t last = LUMINA_7Z_NOT_ARCHIVE;
    for (const auto& h : uniq) {
      if (checkpoint_bridge(&a->bridge) == LUMINA_7Z_CANCELLED) {
        stream->Release();
        a->stream = nullptr;
        delete a;
        return LUMINA_7Z_CANCELLED;
      }
      last = try_open_handler(a, h);
      if (last == LUMINA_7Z_OK) break;
      if (last == LUMINA_7Z_PASSWORD_REQUIRED || last == LUMINA_7Z_WRONG_PASSWORD) break;
    }
    if (last != LUMINA_7Z_OK) {
      stream->Release();
      a->stream = nullptr;
      delete a;
      return last;
    }
    *out = reinterpret_cast<lumina_7z_archive*>(a);
    return LUMINA_7Z_OK;
  });
}

int32_t api_info(lumina_7z_archive* ha, char* format, uint32_t format_cap, uint32_t* item_count, int64_t* phy_size, int32_t* solid, int32_t* encrypted) {
  return guard([&]() -> int32_t {
    auto* a = reinterpret_cast<Archive*>(ha);
    if (!a || !a->in) return LUMINA_7Z_ARG;
    if (format && format_cap) {
      std::strncpy(format, a->format.c_str(), format_cap - 1);
      format[format_cap - 1] = 0;
    }
    if (item_count) *item_count = a->items;
    if (phy_size) {
      PROPVARIANT v;
      PropVariantInit(&v);
      if (a->in->GetArchiveProperty(kpidPhySize, &v) == S_OK) prop_to_i64(v, phy_size);
      else *phy_size = -1;
      clear_prop(v);
    }
    if (solid) {
      PROPVARIANT v;
      PropVariantInit(&v);
      if (a->in->GetArchiveProperty(kpidSolid, &v) == S_OK) prop_to_bool(v, solid);
      else *solid = -1;
      clear_prop(v);
    }
    if (encrypted) {
      PROPVARIANT v;
      PropVariantInit(&v);
      if (a->in->GetArchiveProperty(kpidEncrypted, &v) == S_OK) prop_to_bool(v, encrypted);
      else *encrypted = -1;
      clear_prop(v);
    }
    return LUMINA_7Z_OK;
  });
}

int32_t api_list_entry(lumina_7z_archive* ha, uint32_t index, lumina_7z_entry* out, char* path_utf8, uint32_t path_cap) {
  return guard([&]() -> int32_t {
    auto* a = reinterpret_cast<Archive*>(ha);
    if (!a || !a->in || !out) return LUMINA_7Z_ARG;
    if (index >= a->items) return LUMINA_7Z_ARG;
    if (checkpoint_bridge(&a->bridge) == LUMINA_7Z_CANCELLED) return LUMINA_7Z_CANCELLED;
    std::memset(out, 0, sizeof(*out));
    out->index = index;
    out->is_directory = -1;
    out->uncompressed_size = -1;
    out->packed_size = -1;
    out->encrypted = -1;
    PROPVARIANT v;
    PropVariantInit(&v);
    if (a->in->GetProperty(index, kpidPath, &v) == S_OK) {
      std::string p = prop_bstr_utf8(v);
      if (path_utf8 && path_cap) {
        std::strncpy(path_utf8, p.c_str(), path_cap - 1);
        path_utf8[path_cap - 1] = 0;
      }
    }
    clear_prop(v);
    PropVariantInit(&v);
    if (a->in->GetProperty(index, kpidIsDir, &v) == S_OK) prop_to_bool(v, &out->is_directory);
    clear_prop(v);
    PropVariantInit(&v);
    if (a->in->GetProperty(index, kpidSize, &v) == S_OK) prop_to_i64(v, &out->uncompressed_size);
    clear_prop(v);
    PropVariantInit(&v);
    if (a->in->GetProperty(index, kpidPackSize, &v) == S_OK) prop_to_i64(v, &out->packed_size);
    clear_prop(v);
    PropVariantInit(&v);
    if (a->in->GetProperty(index, kpidCRC, &v) == S_OK) {
      int64_t crc = -1;
      prop_to_i64(v, &crc);
      if (crc >= 0) {
        out->crc_defined = 1;
        out->crc = static_cast<uint32_t>(crc);
      }
    }
    clear_prop(v);
    PropVariantInit(&v);
    if (a->in->GetProperty(index, kpidEncrypted, &v) == S_OK) prop_to_bool(v, &out->encrypted);
    clear_prop(v);
    PropVariantInit(&v);
    if (a->in->GetProperty(index, kpidAttrib, &v) == S_OK) {
      int64_t at = -1;
      prop_to_i64(v, &at);
      if (at >= 0) {
        out->attrib_defined = 1;
        out->attrib = static_cast<uint32_t>(at);
      }
    }
    clear_prop(v);
    return LUMINA_7Z_OK;
  });
}

int32_t api_test(lumina_7z_archive* ha) {
  return guard([&]() -> int32_t {
    auto* a = reinterpret_cast<Archive*>(ha);
    if (!a || !a->in) return LUMINA_7Z_ARG;
    auto* cb = new (std::nothrow) ExtractTestCallback(&a->bridge, &a->password, a->items);
    if (!cb) return LUMINA_7Z_INTERNAL;
    HRESULT hr = a->in->Extract(nullptr, static_cast<UInt32>(-1), 1, cb);
    int32_t worst = cb->worst_result();
    cb->Release();
    if (hr == E_ABORT) {
      if (a->bridge.password_asked.load() && !a->bridge.had_password.load())
        return LUMINA_7Z_PASSWORD_REQUIRED;
      return LUMINA_7Z_CANCELLED;
    }
    if (worst != NArchive::NExtract::NOperationResult::kOK) return map_opres(worst);
    if (hr == S_OK) return LUMINA_7Z_OK;
    if (a->bridge.had_password.load() && hr == S_FALSE) return LUMINA_7Z_WRONG_PASSWORD;
    return map_hresult(hr);
  });
}

int32_t api_close(lumina_7z_archive* ha) {
  return guard([&]() -> int32_t {
    auto* a = reinterpret_cast<Archive*>(ha);
    if (!a) return LUMINA_7Z_OK;
    if (a->in) {
      a->in->Close();
      a->in->Release();
      a->in = nullptr;
    }
    if (a->stream) {
      a->stream->Release();
      a->stream = nullptr;
    }
    a->password.wipe();
    delete a;
    return LUMINA_7Z_OK;
  });
}

} // namespace lumina::sevenzip
