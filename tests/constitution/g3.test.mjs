import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..");
function read(p) { return readFileSync(join(root, p), "utf8"); }

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

test("G3 uses official pinned 7-Zip 26.02", () => {
  const v = JSON.parse(read("eng/versions.json"));
  assert.equal(v.dependencies.sevenZip.version, "26.02");
  assert.equal(v.dependencies.sevenZip.modified, false);
  assert.match(v.dependencies.sevenZip.artifact, /7z2602-x64\.exe/);
  const pins = JSON.parse(read("eng/vendor-pins.json"));
  assert.ok(pins.artifacts.some((a) => a.id === "sevenZipWinX64"));
  assert.ok(pins.artifacts.some((a) => a.id === "sevenZipWinArm64"));
});

test("G3 adapter is isolated SHARED module", () => {
  const cmake = read("native/7z-adapter/CMakeLists.txt");
  assert.match(cmake, /SHARED/);
  assert.match(cmake, /LGPL/);
  assert.equal(existsSync(join(root, "native/7z-adapter/include/lumina/seven_zip_abi.h")), true);
});

test("WinUI and shell still have no codec/parser", () => {
  const win = read("apps/win/Lumina.Win.csproj");
  assert.equal(/(7z|minizip|libarchive)/i.test(win), false);
  const shell = read("native/shell/src/explorer_command.cpp");
  assert.equal(/IArchive|7z\.dll|minizip/i.test(shell), false);
});

test("G3 extraction callback does not create destination files", () => {
  const cb = read("native/7z-adapter/src/callbacks.cpp");
  assert.match(cb, /GetStream/);
  assert.match(cb, /\*outStream = nullptr/);
  assert.equal(/CreateFileW/.test(cb), false);
  assert.equal(/CreateDirectoryW/.test(cb), false);
  assert.equal(/CreateSymbolicLink/.test(cb), false);
});

test("G5 codecs remain disabled", () => {
  const cmake = read("native/engine/CMakeLists.txt");
  assert.match(cmake, /G0 forbids codec enablement/);
  assert.equal(/minizip-ng|zlib-ng|isa-l|libdeflate/i.test(cmake), false);
});

test("product path does not invoke 7z.exe/7zz", () => {
  for (const p of [
    "native/engine/src/g3_job.cpp",
    "native/7z-adapter/src/dll_loader.cpp",
    "src/supervisor/Jobs/JobRuntime.cs",
  ]) {
    const t = read(p);
    assert.equal(/\b7zz(\.exe)?\b/.test(t), false, p);
    assert.equal(/7z\.exe/.test(t), false, p);
  }
});

test("7-Zip notices exist", () => {
  assert.equal(existsSync(join(root, "third_party/7zip-26.02/LICENSE.txt")), true);
  const lic = read("third_party/7zip-26.02/LICENSE.txt");
  assert.match(lic, /GNU LGPL|Lesser General Public License/i);
  const tp = read("THIRD_PARTY.md");
  assert.match(tp, /7-Zip/);
  assert.match(tp, /26\.02/);
});

test("no runtime 7z.dll committed", () => {
  const files = walk(root);
  for (const f of files) {
    const rel = f.slice(root.length + 1).replaceAll("\\", "/");
    assert.equal(rel.endsWith("7z.dll") || rel.endsWith("7z2602-x64.exe"), false, rel);
  }
});

test("G1 baseline unchanged", () => {
  const b = JSON.parse(read("bench/G1-BASELINE.json"));
  assert.equal(b.accepted, true);
  assert.equal(b.sessionId, "g1-2026-08-29T10-35-59-881Z");
});

test("G2 tests remain present", () => {
  assert.equal(existsSync(join(root, "tests/constitution/g2.test.mjs")), true);
  assert.equal(existsSync(join(root, "tests/Lumina.Supervisor.Tests/ResourceGovernorTests.cs")), true);
});

test("G3 fixtures documented", () => {
  assert.equal(existsSync(join(root, "tests/fixtures/g3/README.md")), true);
  assert.equal(existsSync(join(root, "tests/fixtures/g3/plain.7z")), true);
  assert.equal(existsSync(join(root, "tests/fixtures/g3/header-encrypted.7z")), true);
});

test("vendored 26.02 SDK includes NewHandler.h for MSVC Common0.h", () => {
  const p = "third_party/7zip-26.02/sdk/CPP/Common/NewHandler.h";
  assert.equal(existsSync(join(root, p)), true);
  const h = read(p);
  assert.match(h, /ZIP7_INC_COMMON_NEW_HANDLER_H/);
  assert.match(h, /CNewException/);
  const manifest = read("third_party/7zip-26.02/MANIFEST.md");
  assert.match(manifest, /NewHandler\.h/);
  const common0 = read("third_party/7zip-26.02/sdk/CPP/Common/Common0.h");
  assert.match(common0, /#include "NewHandler\.h"/);
});

test("adapter C ABI exports no STL types", () => {
  const abi = read("native/7z-adapter/include/lumina/seven_zip_abi.h");
  assert.match(abi, /lumina_7z_adapter_get_api_v1/);
  assert.match(abi, /LUMINA_7Z_ABI_VERSION 1u/);
  assert.equal(/std::(string|vector|exception)/.test(abi), false);
});

test("G3 does not implement IOutArchive create/update", () => {
  for (const p of [
    "native/7z-adapter/src/archive_ops.cpp",
    "native/7z-adapter/src/callbacks.cpp",
    "native/engine/src/g3_job.cpp",
  ]) {
    const t = read(p);
    assert.equal(/IOutArchive|UpdateItems/.test(t), false, p);
  }
});

test("secure LoadLibraryExW is used for adapter and 7z.dll", () => {
  const loader = read("native/7z-adapter/src/dll_loader.cpp");
  assert.match(loader, /LoadLibraryExW/);
  assert.match(loader, /LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR/);
  assert.match(loader, /LOAD_LIBRARY_SEARCH_SYSTEM32/);
  const job = read("native/engine/src/g3_job.cpp");
  assert.match(job, /LoadLibraryExW/);
  assert.match(job, /LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR/);
  assert.equal(/LoadLibraryW\s*\(\s*L"lumina-7z-adapter/.test(job), false);
});

test("engine assigns event seq under the write mutex", () => {
  const loop = read("native/engine/src/ipc/worker_loop.cpp");
  const m = loop.match(/bool emit\(Ctx& ctx[\s\S]*?return lumina::ipc::write_frame/);
  assert.ok(m, "emit()");
  const lock = m[0].indexOf("lock_guard");
  const seq = m[0].indexOf("event_seq.fetch_add");
  assert.ok(lock >= 0 && seq >= 0 && lock < seq, "seq must be assigned after write_mu is held");
});
