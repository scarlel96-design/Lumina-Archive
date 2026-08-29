#include "protocol.hpp"

#include <iostream>
#include <string>
#include <vector>

using lumina::ipc::Envelope;
using lumina::ipc::parse_envelope;

static int g_fail = 0;

static void expect_fail(const char* name, const std::string& json) {
  Envelope env;
  std::string err;
  if (parse_envelope(json, env, err)) {
    std::cerr << "FAIL " << name << " accepted: " << json << "\n";
    g_fail++;
  }
}

static void expect_ok(const char* name, const std::string& json, bool secret) {
  Envelope env;
  std::string err;
  if (!parse_envelope(json, env, err)) {
    std::cerr << "FAIL " << name << " rejected: " << err << " json=" << json << "\n";
    g_fail++;
    return;
  }
  if (env.secret_required != secret) {
    std::cerr << "FAIL " << name << " secret_required got " << env.secret_required << "\n";
    g_fail++;
  }
}

int main() {
  const std::string valid =
      "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}";
  expect_ok("valid pause", valid, false);

  expect_ok("whitespace",
            "{\n  \"protocol_version\" : 1 ,\n  \"job_id\" : \"abc\" ,\n  \"seq\" : 0 ,\n"
            "  \"kind\" : \"command\" ,\n  \"type\" : \"start\" ,\n"
            "  \"payload\" : { \"secret_required\" : true }\n}",
            true);

  expect_ok("secret compact",
            "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\","
            "\"type\":\"start\",\"payload\":{\"secret_required\":true}}",
            true);

  expect_ok("secret false",
            "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\","
            "\"type\":\"start\",\"payload\":{\"secret_required\":false}}",
            false);

  expect_fail("missing comma",
              "{\"protocol_version\":1 \"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
  expect_fail("trailing comma",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{},}");
  expect_fail("garbage after root", valid + " true");
  expect_fail("duplicate field",
              "{\"protocol_version\":1,\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
  expect_fail("missing payload",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\"}");
  expect_fail("payload not object",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":[]}");
  expect_fail("invalid json in payload",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{");
  expect_fail("invalid escape",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{\"x\":\"\\q\"}}");
  expect_fail("wrong version",
              "{\"protocol_version\":2,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
  expect_fail("negative seq",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":-1,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
  expect_fail("non-integer seq",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":1.5,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
  expect_fail("unknown command",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"explode\",\"payload\":{}}");
  expect_fail("unknown field",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{},\"nope\":1}");
  expect_fail("kind number",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":1,\"type\":\"pause\",\"payload\":{}}");
  expect_fail("type bool",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":true,\"payload\":{}}");
  expect_fail("job_id number",
              "{\"protocol_version\":1,\"job_id\":1,\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
  expect_fail("event kind",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"event\",\"type\":\"heartbeat\",\"payload\":{}}");
  expect_fail("empty job_id",
              "{\"protocol_version\":1,\"job_id\":\"\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
  expect_fail("secret_required string",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"start\",\"payload\":{\"secret_required\":\"true\"}}");
  expect_fail("pause extra field",
              "{\"protocol_version\":1,\"job_id\":\"abc\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{\"x\":1}}");

  std::string bad_utf8 = valid;
  bad_utf8[2] = static_cast<char>(0xFF);
  expect_fail("invalid utf-8", bad_utf8);

  if (g_fail) {
    std::cerr << g_fail << " native parser tests failed\n";
    return 1;
  }
  std::cout << "lumina-ipc-parse-test PASS\n";
  return 0;
}
