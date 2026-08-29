import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parse7zip, rejectSecretArgv } from "../../bench/scripts/parsers.mjs";

const root = join(import.meta.dirname, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("G1 required files exist", () => {
  for (const p of [
    "bench/PROTOCOL.md",
    "docs/BENCHMARKING.md",
    "bench/README.md",
    "bench/RESULTS.md",
    "bench/corpus.manifest.json",
    "bench/result.schema.json",
    "bench/scripts/run-harness.mjs",
    "bench/scripts/fetch-vendors.mjs",
    "bench/scripts/verify-pins.mjs",
    "eng/vendor-pins.json",
    ".github/workflows/bench-harness.yml",
  ]) {
    assert.ok(existsSync(join(root, p)), p);
  }
});

test("vendor pins are real hex and exclude Bandizip binaries", () => {
  const pins = JSON.parse(read("eng/vendor-pins.json"));
  assert.ok(pins.artifacts.length >= 10);
  for (const a of pins.artifacts) {
    assert.match(a.sha256, /^[0-9a-f]{64}$/);
    assert.equal(a.sha256.includes("PENDING"), false);
  }
  const names = pins.artifacts.map((a) => `${a.url} ${a.artifact}`).join("\n");
  assert.equal(/Bandizip\.exe|WinRAR/i.test(names), false);
  assert.ok(pins.neverVendor.includes("Bandizip"));
});

test("versions.json sha256 matches vendor-pins", () => {
  const versions = JSON.parse(read("eng/versions.json"));
  const pins = JSON.parse(read("eng/vendor-pins.json"));
  for (const [key, dep] of Object.entries(versions.dependencies)) {
    assert.notEqual(dep.sha256, "PENDING_OFFICIAL_ARTIFACT", key);
    assert.ok(
      pins.artifacts.some((a) => a.dep === key && a.sha256 === dep.sha256),
      key,
    );
  }
});

test("RESULTS.md has no invented timings and forbids marketing", () => {
  const text = read("bench/RESULTS.md");
  assert.match(text, /not evidence/i);
  assert.match(text, /must not claim/i);
  assert.equal(/\b\d+\.\d{2}\s*s\b/.test(text), false);
  assert.equal(/geometric mean/.test(text.toLowerCase()) && /1\.05/.test(text), false);
});

test("PROTOCOL forbids GitHub runner as competitor baseline", () => {
  const text = read("bench/PROTOCOL.md");
  assert.match(text, /physical-windows/);
  assert.match(text, /Never/);
  assert.match(text, /github-runner-not-authoritative/);
  assert.match(text, /SKIPPED_NOT_LINKED/);
  assert.match(text, /MUST NOT be required for G1 PASS/i);
});

test("G1 must not require Lumina I/O (circular dependency closed)", () => {
  const bench = read("docs/BENCHMARKING.md");
  const status = read("docs/STATUS.md");
  const adr = read("docs/DECISIONS.md");
  assert.match(bench, /Lumina is not required for G1 PASS/);
  assert.match(bench, /G5 — Competitive Performance Gate/);
  assert.match(bench, /SKIPPED_NOT_LINKED/);
  assert.match(status, /SKIPPED_NOT_LINKED/);
  assert.match(status, /circular dependency/);
  assert.match(status, /RESOLVED/);
  assert.match(adr, /ADR-0013/);
  assert.equal(/G1.*requires Lumina archive I\/O/i.test(status), false);
});

test("Lumina skip code is SKIPPED_NOT_LINKED", () => {
  const harness = read("bench/scripts/measure.mjs");
  const parser = read("bench/scripts/parsers.mjs");
  assert.match(harness, /SKIPPED_NOT_LINKED/);
  assert.match(parser, /SKIPPED_NOT_LINKED/);
});

test("CMake still forbids codec enablement", () => {
  assert.match(read("native/engine/CMakeLists.txt"), /G0 forbids codec enablement/);
});

test("shell still has no parser", () => {
  assert.equal(/minizip|archive\.h|7z\.h/.test(read("native/shell/src/explorer_command.cpp")), false);
});

test("7-Zip parser fixture", () => {
  const p = parse7zip("7-Zip (z) 26.02 (x64)\nArchive size: 8474 bytes\nEverything is Ok\n");
  assert.equal(p.version, "26.02");
  assert.equal(p.ok, true);
});

test("secret argv rejected", () => {
  assert.throws(() => rejectSecretArgv(["7zz", "a", "-pfoo", "x.zip"]));
});
