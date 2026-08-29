#include "protocol.hpp"
#include <cctype>
#include <stdexcept>

namespace lumina::ipc {
namespace {

struct Parser {
  const std::string& s;
  size_t i = 0;
  explicit Parser(const std::string& in) : s(in) {}
  void skip() { while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) i++; }
  bool eat(char c) { skip(); if (i < s.size() && s[i] == c) { i++; return true; } return false; }
  std::string parse_string() {
    skip();
    if (i >= s.size() || s[i] != '"') throw std::runtime_error("string");
    i++;
    std::string out;
    while (i < s.size()) {
      char c = s[i++];
      if (c == '"') return out;
      if (c == '\\') {
        if (i >= s.size()) throw std::runtime_error("escape");
        char e = s[i++];
        if (e == '"' || e == '\\' || e == '/') out.push_back(e);
        else if (e == 'n') out.push_back('\n');
        else if (e == 't') out.push_back('\t');
        else throw std::runtime_error("escape");
      } else {
        if (static_cast<unsigned char>(c) < 0x20) throw std::runtime_error("control");
        out.push_back(c);
      }
    }
    throw std::runtime_error("unterminated");
  }
  int parse_int() {
    skip();
    if (i < s.size() && s[i] == '-') throw std::runtime_error("negative");
    if (i >= s.size() || !std::isdigit(static_cast<unsigned char>(s[i]))) throw std::runtime_error("int");
    long v = 0;
    while (i < s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) {
      v = v * 10 + (s[i++] - '0');
      if (v > 1'000'000'000) throw std::runtime_error("int");
    }
    return static_cast<int>(v);
  }
  bool parse_bool() {
    skip();
    if (s.compare(i, 4, "true") == 0) { i += 4; return true; }
    if (s.compare(i, 5, "false") == 0) { i += 5; return false; }
    throw std::runtime_error("bool");
  }
  std::string parse_object_raw() {
    skip();
    size_t start = i;
    if (!eat('{')) throw std::runtime_error("object");
    int depth = 1;
    bool in_str = false;
    bool esc = false;
    while (i < s.size() && depth) {
      char c = s[i++];
      if (in_str) {
        if (esc) esc = false;
        else if (c == '\\') esc = true;
        else if (c == '"') in_str = false;
      } else {
        if (c == '"') in_str = true;
        else if (c == '{') depth++;
        else if (c == '}') depth--;
      }
    }
    if (depth != 0) throw std::runtime_error("object");
    return s.substr(start, i - start);
  }
};

} // namespace

bool parse_envelope(const std::string& json, Envelope& out, std::string& error) {
  try {
    Parser p(json);
    if (!p.eat('{')) throw std::runtime_error("root");
    bool seen_payload = false;
    out = Envelope{};
    while (true) {
      p.skip();
      if (p.eat('}')) break;
      std::string key = p.parse_string();
      if (!p.eat(':')) throw std::runtime_error("colon");
      if (key == "protocol_version") out.protocol_version = p.parse_int();
      else if (key == "job_id") out.job_id = p.parse_string();
      else if (key == "seq") out.seq = p.parse_int();
      else if (key == "kind") out.kind = p.parse_string();
      else if (key == "type") out.type = p.parse_string();
      else if (key == "payload") {
        out.payload_json = p.parse_object_raw();
        seen_payload = true;
        if (out.payload_json.find("\"secret_required\":true") != std::string::npos ||
            out.payload_json.find("\"secret_required\": true") != std::string::npos)
          out.secret_required = true;
      } else throw std::runtime_error("forbidden field");
      p.skip();
      p.eat(',');
    }
    if (!seen_payload || out.job_id.empty() || out.kind.empty() || out.type.empty() || out.seq < 0)
      throw std::runtime_error("required");
    if (out.kind != "command") throw std::runtime_error("kind");
    return true;
  } catch (const std::exception& ex) {
    error = ex.what();
    return false;
  }
}

std::string json_escape(const std::string& s) {
  std::string o;
  o.reserve(s.size() + 8);
  for (char c : s) {
    if (c == '"' || c == '\\') { o.push_back('\\'); o.push_back(c); }
    else o.push_back(c);
  }
  return o;
}

std::string make_event(int version, const std::string& job, int seq, const std::string& type, const std::string& payload_object) {
  std::string p = payload_object.empty() ? "{}" : payload_object;
  return std::string("{\"protocol_version\":") + std::to_string(version) +
         ",\"job_id\":\"" + json_escape(job) + "\",\"seq\":" + std::to_string(seq) +
         ",\"kind\":\"event\",\"type\":\"" + json_escape(type) + "\",\"payload\":" + p + "}";
}

} // namespace lumina::ipc
