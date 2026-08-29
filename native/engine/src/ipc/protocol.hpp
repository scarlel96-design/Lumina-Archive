#pragma once
#include <optional>
#include <string>

namespace lumina::ipc {

struct Envelope {
  int protocol_version = 0;
  std::string job_id;
  int seq = -1;
  std::string kind;
  std::string type;
  std::string payload_json; // object text including braces
  bool secret_required = false;
  std::string operation;
  std::string source_path;
  std::string format_hint;
  std::string g2_mode;
};

bool parse_envelope(const std::string& json, Envelope& out, std::string& error);
std::string make_event(int version, const std::string& job, int seq, const std::string& type, const std::string& payload_object);

} // namespace lumina::ipc
