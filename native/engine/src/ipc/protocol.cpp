#include "protocol.hpp"

#include <nlohmann/json.hpp>

#include <set>
#include <string>
#include <vector>

namespace lumina::ipc {
namespace {

using json = nlohmann::json;

class StrictSax : public nlohmann::json_sax<json> {
 public:
  std::string error;
  std::vector<std::set<std::string>> objects;

  bool null() override { return true; }
  bool boolean(bool) override { return true; }
  bool number_integer(number_integer_t) override { return true; }
  bool number_unsigned(number_unsigned_t) override { return true; }
  bool number_float(number_float_t, const string_t&) override { return true; }
  bool string(string_t&) override { return true; }
  bool binary(binary_t&) override { return true; }
  bool start_object(std::size_t) override {
    objects.emplace_back();
    return true;
  }
  bool end_object() override {
    if (objects.empty()) return false;
    objects.pop_back();
    return true;
  }
  bool start_array(std::size_t) override { return true; }
  bool end_array() override { return true; }
  bool key(string_t& k) override {
    if (objects.empty()) {
      error = "key outside object";
      return false;
    }
    if (!objects.back().insert(k).second) {
      error = "duplicate field";
      return false;
    }
    return true;
  }
  bool parse_error(std::size_t, const std::string&, const nlohmann::detail::exception& ex) override {
    error = ex.what();
    return false;
  }
};

bool only_keys(const json& obj, std::initializer_list<const char*> allowed, std::string& error) {
  for (auto it = obj.begin(); it != obj.end(); ++it) {
    bool ok = false;
    for (auto k : allowed) {
      if (it.key() == k) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      error = "payload field " + it.key();
      return false;
    }
  }
  return true;
}

bool validate_command_payload(const std::string& type, const json& payload, Envelope& out, std::string& error) {
  if (!payload.is_object()) {
    error = "payload must be object";
    return false;
  }
  if (type == "pause" || type == "resume" || type == "shutdown")
    return only_keys(payload, {}, error);
  if (type == "cancel")
    return only_keys(payload, {"reason"}, error);
  if (type == "start") {
    if (!only_keys(payload, {"job_kind", "secret_required", "grant", "g2_mode"}, error))
      return false;
    if (payload.contains("secret_required")) {
      if (!payload["secret_required"].is_boolean()) {
        error = "secret_required type";
        return false;
      }
      out.secret_required = payload["secret_required"].get<bool>();
    }
    if (payload.contains("grant") && !payload["grant"].is_object()) {
      error = "grant type";
      return false;
    }
    if (payload.contains("job_kind") && !payload["job_kind"].is_string()) {
      error = "job_kind type";
      return false;
    }
    if (payload.contains("g2_mode") && !payload["g2_mode"].is_string()) {
      error = "g2_mode type";
      return false;
    }
    return true;
  }
  error = "unknown command";
  return false;
}

} // namespace

bool parse_envelope(const std::string& json_text, Envelope& out, std::string& error) {
  out = Envelope{};
  StrictSax sax;
  if (!json::sax_parse(json_text, &sax, json::input_format_t::json, /*strict=*/true, /*ignore_comments=*/false)) {
    error = sax.error.empty() ? "malformed JSON" : sax.error;
    return false;
  }
  json root = json::parse(json_text, nullptr, false, false);
  if (root.is_discarded() || !root.is_object()) {
    error = "root must be object";
    return false;
  }

  bool seen_version = false, seen_job = false, seen_seq = false, seen_kind = false, seen_type = false, seen_payload = false;
  for (auto it = root.begin(); it != root.end(); ++it) {
    const auto& k = it.key();
    const auto& v = it.value();
    if (k == "protocol_version") {
      seen_version = true;
      if (!v.is_number_integer() || v.get<long long>() != 1) {
        error = "protocol_version";
        return false;
      }
      out.protocol_version = 1;
    } else if (k == "job_id") {
      seen_job = true;
      if (!v.is_string() || v.get<std::string>().empty()) {
        error = "job_id";
        return false;
      }
      out.job_id = v.get<std::string>();
    } else if (k == "seq") {
      seen_seq = true;
      if (!v.is_number_integer() || v.get<long long>() < 0 || v.get<long long>() > 1'000'000'000LL) {
        error = "seq";
        return false;
      }
      out.seq = static_cast<int>(v.get<long long>());
    } else if (k == "kind") {
      seen_kind = true;
      if (!v.is_string()) {
        error = "kind type";
        return false;
      }
      out.kind = v.get<std::string>();
    } else if (k == "type") {
      seen_type = true;
      if (!v.is_string()) {
        error = "type type";
        return false;
      }
      out.type = v.get<std::string>();
    } else if (k == "payload") {
      seen_payload = true;
      if (!v.is_object()) {
        error = "payload must be object";
        return false;
      }
      out.payload_json = v.dump();
    } else {
      error = "forbidden field " + k;
      return false;
    }
  }

  if (!seen_version || !seen_job || !seen_seq || !seen_kind || !seen_type || !seen_payload) {
    error = "required field missing";
    return false;
  }
  if (out.kind != "command") {
    error = "kind";
    return false;
  }
  static const std::set<std::string> commands{"start", "pause", "resume", "cancel", "shutdown"};
  if (!commands.count(out.type)) {
    error = "unknown command";
    return false;
  }
  return validate_command_payload(out.type, root["payload"], out, error);
}

std::string json_escape(const std::string& s) {
  return json(s).dump();
}

std::string make_event(int version, const std::string& job, int seq, const std::string& type, const std::string& payload_object) {
  json payload = json::object();
  if (!payload_object.empty()) {
    payload = json::parse(payload_object, nullptr, false, false);
    if (payload.is_discarded() || !payload.is_object()) payload = json::object();
  }
  json ev = {
      {"protocol_version", version},
      {"job_id", job},
      {"seq", seq},
      {"kind", "event"},
      {"type", type},
      {"payload", payload},
  };
  return ev.dump();
}

} // namespace lumina::ipc
