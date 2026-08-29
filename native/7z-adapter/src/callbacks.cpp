#include "internal.hpp"

namespace lumina::sevenzip {

HRESULT OpenCallback::QueryInterface(REFIID iid, void** pp) {
  if (!pp) return E_POINTER;
  *pp = nullptr;
  if (iid == IID_IUnknown || iid == IID_IArchiveOpenCallback) {
    *pp = static_cast<IArchiveOpenCallback*>(this);
  } else if (iid == IID_ICryptoGetTextPassword) {
    *pp = static_cast<ICryptoGetTextPassword*>(this);
  } else if (iid == IID_ICryptoGetTextPassword2) {
    *pp = static_cast<ICryptoGetTextPassword2*>(this);
  } else {
    return E_NOINTERFACE;
  }
  AddRef();
  return S_OK;
}

HRESULT OpenCallback::SetTotal(const UInt64*, const UInt64*) {
  return checkpoint_bridge(bridge_) == LUMINA_7Z_CANCELLED ? E_ABORT : S_OK;
}
HRESULT OpenCallback::SetCompleted(const UInt64*, const UInt64*) {
  return checkpoint_bridge(bridge_) == LUMINA_7Z_CANCELLED ? E_ABORT : S_OK;
}
HRESULT OpenCallback::CryptoGetTextPassword(BSTR* password) {
  return give_password(bridge_, pw_, password, nullptr);
}
HRESULT OpenCallback::CryptoGetTextPassword2(Int32* defined, BSTR* password) {
  return give_password(bridge_, pw_, password, defined);
}

HRESULT ExtractTestCallback::QueryInterface(REFIID iid, void** pp) {
  if (!pp) return E_POINTER;
  *pp = nullptr;
  if (iid == IID_IUnknown || iid == IID_IProgress || iid == IID_IArchiveExtractCallback) {
    *pp = static_cast<IArchiveExtractCallback*>(this);
  } else if (iid == IID_ICryptoGetTextPassword) {
    *pp = static_cast<ICryptoGetTextPassword*>(this);
  } else if (iid == IID_ICryptoGetTextPassword2) {
    *pp = static_cast<ICryptoGetTextPassword2*>(this);
  } else {
    return E_NOINTERFACE;
  }
  AddRef();
  return S_OK;
}

HRESULT ExtractTestCallback::checkpoint() {
  return checkpoint_bridge(bridge_) == LUMINA_7Z_CANCELLED ? E_ABORT : S_OK;
}

HRESULT ExtractTestCallback::SetTotal(UInt64 total) {
  if (bridge_) bridge_->progress_total.store(static_cast<int64_t>(total));
  if (bridge_ && bridge_->cb.report_progress)
    bridge_->cb.report_progress(bridge_->cb.user, bridge_->progress_done.load(), static_cast<int64_t>(total), done_items_, total_items_, "test");
  return checkpoint();
}

HRESULT ExtractTestCallback::SetCompleted(const UInt64* completeValue) {
  if (completeValue && bridge_) {
    bridge_->progress_done.store(*completeValue);
    ULONGLONG now = GetTickCount64();
    if (now - last_progress_tick_ >= 50 || *completeValue == static_cast<UInt64>(bridge_->progress_total.load())) {
      last_progress_tick_ = now;
      if (bridge_->cb.report_progress)
        bridge_->cb.report_progress(bridge_->cb.user, *completeValue, bridge_->progress_total.load(), done_items_, total_items_, "test");
    }
  }
  return checkpoint();
}

HRESULT ExtractTestCallback::GetStream(UInt32, ISequentialOutStream** outStream, Int32 askExtractMode) {
  if (outStream) *outStream = nullptr;
  /* G3 test/skip never creates filesystem output. */
  (void)askExtractMode;
  return checkpoint();
}

HRESULT ExtractTestCallback::PrepareOperation(Int32) { return checkpoint(); }

HRESULT ExtractTestCallback::SetOperationResult(Int32 opRes) {
  ++done_items_;
  if (opRes != NArchive::NExtract::NOperationResult::kOK && worst_ == NArchive::NExtract::NOperationResult::kOK)
    worst_ = opRes;
  if (bridge_) bridge_->last_op_res.store(opRes);
  return checkpoint();
}

HRESULT ExtractTestCallback::CryptoGetTextPassword(BSTR* password) {
  return give_password(bridge_, pw_, password, nullptr);
}
HRESULT ExtractTestCallback::CryptoGetTextPassword2(Int32* defined, BSTR* password) {
  return give_password(bridge_, pw_, password, defined);
}

} // namespace lumina::sevenzip
