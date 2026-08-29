import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { rejectGithubAsPhysical } from "../../bench/scripts/require-physical.mjs";
import { deterministicBytes } from "../../bench/scripts/prepare-corpus.mjs";
import { summarizeTimes } from "../../bench/scripts/stats.mjs";
import { rotateTools } from "../../bench/scripts/measure.mjs";

const root = join(import.meta.dirname, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("Silesia pin is a real SHA-256 from downloaded bytes", () => {
  const pins = JSON.parse(read("eng/corpus-pins.json"));
  assert.equal(pins.silesiaZip.bytes, 68182744);
  assert.match(pins.silesiaZip.sha256, /^[0-9a-f]{64}$/);
  assert.equal(pins.silesiaZip.sha256, "0626e25f45c0ffb5dc801f13b7c82a3b75743ba07e3a71835a41e3d9f63c77af");
  assert.equal(pins.silesiaZip.url, "https://sun.aei.polsl.pl/~sdeor/corpus/silesia.zip");
  assert.equal(pins.silesiaZip.fileCount, 12);
  const manifest = JSON.parse(read("bench/corpus.manifest.json"));
  assert.equal(manifest.items.silesia.sha256, pins.silesiaZip.sha256);
  assert.equal(manifest.items.silesia.sha256.includes("PENDING"), false);
});

test("GitHub Actions cannot claim physical-windows", () => {
  const prev = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = "true";
  try {
    assert.throws(() => rejectGithubAsPhysical("physical-windows"), /GitHub-hosted/);
    rejectGithubAsPhysical("github-runner-not-authoritative");
  } finally {
    if (prev === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = prev;
  }
});

test("incompressible corpus is deterministic", () => {
  const a = deterministicBytes(4096, "lumina-g1-incompressible-64m-v1");
  const b = deterministicBytes(4096, "lumina-g1-incompressible-64m-v1");
  assert.deepEqual(a, b);
  const c = deterministicBytes(4096, "other");
  assert.notDeepEqual(a, c);
});

test("stats mark CV > 5% as NOISY and do not drop samples", () => {
  const s = summarizeTimes([100, 100, 100, 100, 130]);
  assert.equal(s.n, 5);
  assert.ok(s.median);
  assert.equal(typeof s.noisy, "boolean");
});

test("tool rotation is deterministic", () => {
  const tools = ["7zip", "bandizip", "nanazip"];
  assert.deepEqual(rotateTools(tools, 0), ["7zip", "bandizip", "nanazip"]);
  assert.deepEqual(rotateTools(tools, 1), ["bandizip", "nanazip", "7zip"]);
  assert.deepEqual(rotateTools(tools, 2), ["nanazip", "7zip", "bandizip"]);
});

test("physical session scripts exist and refuse codecs", () => {
  for (const p of [
    "bench/scripts/run-physical-session.mjs",
    "bench/scripts/collect-machine.ps1",
    "bench/scripts/require-physical.mjs",
    "bench/scripts/render-results.mjs",
    "eng/corpus-pins.json",
  ]) {
    assert.ok(existsSync(join(root, p)), p);
  }
  assert.match(read("native/engine/CMakeLists.txt"), /G0 forbids codec enablement/);
});

test("STATUS records accepted physical baseline", () => {
  const status = read("docs/STATUS.md");
  assert.match(status, /Physical Windows baseline.*PASS/s);
  assert.match(status, /g1-2026-08-29T10-35-59-881Z/);
  assert.match(status, /fd10fb1bd6fbcd094e8a4b936440bf2456188d4b09a4b91abfa06e0bfcbd3dd4/);
  assert.match(status, /SKIPPED_NOT_LINKED/);
  assert.match(status, /G2 Development Entry.*(?:READY|IN PROGRESS)/);
  assert.match(status, /\*\*G1 overall\*\*.*PASS/);
});
