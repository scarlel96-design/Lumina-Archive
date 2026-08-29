import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "bin" || name === "obj" || name === "build" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

test("G2 required files exist", () => {
  for (const p of [
    "src/supervisor/Ipc/IpcFrame.cs",
    "src/supervisor/Ipc/ControlPipeServer.cs",
    "src/supervisor/Process/EngineProcessLauncher.cs",
    "src/supervisor/Process/WindowsJobObject.cs",
    "src/supervisor/Jobs/JobSupervisor.cs",
    "src/supervisor/Recovery/JobJournalStore.cs",
    "src/supervisor/Resources/ResourceGovernor.cs",
    "native/engine/src/ipc/worker_loop.cpp",
    "native/engine/src/ipc/protocol_test.cpp",
    "third_party/nlohmann/json.hpp",
    "docs/IPC.md",
    "bench/G1-BASELINE.json",
  ]) {
    assert.ok(existsSync(join(root, p)), p);
  }
});

test("G2 does not enable codecs", () => {
  const cmake = read("native/engine/CMakeLists.txt");
  assert.match(cmake, /G0 forbids codec enablement/);
  assert.equal(/minizip|7z\.dll|zlib-ng|isa-l|libdeflate/i.test(cmake), false);
  const loop = read("native/engine/src/ipc/worker_loop.cpp");
  assert.equal(/7z\.h|mz_zip|archive\.h/i.test(loop), false);
});

test("pause is cooperative not SuspendThread", () => {
  for (const f of walk(join(root, "src/supervisor"))) {
    if (!f.endsWith(".cs")) continue;
    const t = readFileSync(f, "utf8");
    assert.equal(/SuspendThread|NtSuspendProcess/.test(t), false, f);
  }
});

test("control frame max and secret pipe exist", () => {
  const c = read("src/supervisor/Ipc/ProtocolConstants.cs");
  assert.match(c, /MaxControlFrameBytes = 1 \* 1024 \* 1024/);
  assert.match(c, /MaxSecretBytes = 64 \* 1024/);
  assert.match(read("src/supervisor/Ipc/ControlPipeServer.cs"), /SecretPipeServer/);
  assert.match(read("src/supervisor/Process/WindowsJobObject.cs"), /KILL_ON_JOB_CLOSE/);
});

test("payload is required in schema", () => {
  const schema = JSON.parse(read("docs/ipc/protocol.schema.json"));
  assert.ok(schema.required.includes("payload"));
  assert.equal(schema.additionalProperties, false);
});

test("G1 baseline remains accepted", () => {
  const b = JSON.parse(read("bench/G1-BASELINE.json"));
  assert.equal(b.accepted, true);
  assert.equal(b.sessionId, "g1-2026-08-29T10-35-59-881Z");
});

test("engine argv still refuses passwords", () => {
  const main = read("native/engine/src/main.cpp");
  assert.match(main, /never read passwords from argv/);
  assert.equal(/password/i.test(main.split("never read passwords from argv")[1] || "password"), false);
  assert.match(main, /strtol/);
  assert.equal(/std::stoi/.test(main), false);
});

test("native protocol uses nlohmann json not handwritten Parser", () => {
  const proto = read("native/engine/src/ipc/protocol.cpp");
  assert.match(proto, /nlohmann\/json\.hpp/);
  assert.equal(/struct Parser/.test(proto), false);
  assert.equal(/secret_required":true/.test(proto), false);
});

test("ResourceGovernor drains from queue head", () => {
  const gov = read("src/supervisor/Resources/ResourceGovernor.cs");
  assert.match(gov, /Peek\(\)/);
  assert.match(gov, /_waiters\.Count == 0 && TryReserveUnlocked/);
});

test("TerminateJobObject result is checked", () => {
  const job = read("src/supervisor/Process/WindowsJobObject.cs");
  assert.match(job, /TryTerminate/);
  assert.match(job, /GetLastWin32Error/);
  assert.match(job, /JobObjectTerminateFailed/);
});

test("native parser tests actually run", () => {
  const exe = "/tmp/lumina-g2-ipc-parse-test";
  const r = spawnSync("g++", [
    "-std=c++20", "-O1",
    "-I", join(root, "third_party"),
    "-I", join(root, "native/engine/include"),
    "-I", join(root, "native/engine/src"),
    join(root, "native/engine/src/ipc/protocol.cpp"),
    join(root, "native/engine/src/ipc/protocol_test.cpp"),
    "-o", exe,
  ], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const run = spawnSync(exe, { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /PASS/);
});
