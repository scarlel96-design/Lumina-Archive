import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { treeManifest, manifestsEqual } from "../../bench/scripts/tree-hash.mjs";
import { extractDestPath, extractArgs, createArgs } from "../../bench/scripts/fixtures.mjs";
import { assertPhysicalBandizipPath, assertExactVersion, parseSevenZipVersion } from "../../bench/scripts/versions-detect.mjs";
import { extractionPolicy, EXTRACTION_THREAD_POLICY_AUTO, EXTRACTION_THREAD_POLICY_AFFINITY, assertNoFalseExtractThreads } from "../../bench/scripts/thread-policy.mjs";
import { emptyTelemetry, infrastructureOk } from "../../bench/scripts/telemetry.mjs";
import { rotateCreateProducers, CACHE_POLICY, assertAffinityNotAssumed } from "../../bench/scripts/thread-policy.mjs";
import { summarizeTimes } from "../../bench/scripts/stats.mjs";



test("strict manifestsEqual uses full relative path not basename", async () => {
  const root = await mkdtemp(join(tmpdir(), "lumina-m-"));
  const a = join(root, "src");
  const b = join(root, "moved");
  const c = join(root, "dup");
  await mkdir(join(a, "a"), { recursive: true });
  await mkdir(join(a, "b"), { recursive: true });
  await writeFile(join(a, "a", "config.json"), "left");
  await writeFile(join(a, "b", "config.json"), "right");
  await mkdir(join(b, "a"), { recursive: true });
  await mkdir(join(b, "b"), { recursive: true });
  await writeFile(join(b, "a", "config.json"), "right");
  await writeFile(join(b, "b", "config.json"), "left");
  await mkdir(join(c, "a"), { recursive: true });
  await writeFile(join(c, "a", "config.json"), "left");
  const ma = await treeManifest(a);
  const swapped = await treeManifest(b);
  const missing = await treeManifest(c);
  assert.equal(manifestsEqual(ma, swapped), false);
  assert.equal(manifestsEqual(ma, missing), false);
  const mutatedDir = join(root, "mut");
  await mkdir(join(mutatedDir, "a"), { recursive: true });
  await mkdir(join(mutatedDir, "b"), { recursive: true });
  await writeFile(join(mutatedDir, "a", "config.json"), "left-changed");
  await writeFile(join(mutatedDir, "b", "config.json"), "right");
  assert.equal(manifestsEqual(ma, await treeManifest(mutatedDir)), false);
  assert.equal(manifestsEqual(ma, ma), true);
  await rm(root, { recursive: true, force: true });
});

test("extract destinations are unique per iteration and start clean", () => {
  const d0 = extractDestPath("/work", "zip-by-7zip", "bandizip", 0);
  const d1 = extractDestPath("/work", "zip-by-7zip", "bandizip", 1);
  assert.notEqual(d0, d1);
  assert.match(d0, /run-0/);
  assert.match(d1, /run-1/);
});

test("same fixture archive is the extract input for every extractor", () => {
  const fixture = { archive: "/fix/A.zip", archiveSha256: "abc", format: "zip", producer: "7zip" };
  const extractors = ["7zip", "bandizip", "nanazip"];
  const args = extractors.map((id) =>
    extractArgs({ kind: id, id }, fixture.archive, extractDestPath("/w", "zip-by-7zip", id, 0)),
  );
  for (const a of args) assert.ok(a.includes(fixture.archive));
});

test("exit 0 with wrong tree is invalid", () => {
  const src = { files: [{ path: "a/x", bytes: 1, sha256: "aa" }], treeSha256: "t1" };
  const wrong = { files: [{ path: "b/x", bytes: 1, sha256: "aa" }], treeSha256: "t2" };
  const hash_ok = manifestsEqual(src, wrong);
  const valid = 0 === 0 && hash_ok;
  assert.equal(valid, false);
});

test("Bandizip extract args do not include compression -t", () => {
  const argv = extractArgs({ kind: "bandizip", id: "bandizip" }, "A.zip", "/out");
  assert.equal(argv.some((x) => String(x).startsWith("-t:")), false);
  const create = createArgs({ kind: "bandizip", id: "bandizip" }, "A.zip", ["f"], 8, "zip");
  assert.ok(create.includes("-t:8"));
});

test("NATIVE_AUTO must not claim fixed extract threads", () => {
  const rec = { op: "zip-extract", extractionThreadPolicy: EXTRACTION_THREAD_POLICY_AUTO, claimedFixedExtractThreads: true };
  assert.throws(() => assertNoFalseExtractThreads(rec));
  const ok = { op: "zip-extract", extractionThreadPolicy: EXTRACTION_THREAD_POLICY_AUTO, claimedFixedExtractThreads: false };
  assertNoFalseExtractThreads(ok);
  assert.equal(extractionPolicy(null).extractionThreadPolicy, EXTRACTION_THREAD_POLICY_AUTO);
  assert.equal(extractionPolicy("/helper.exe").extractionThreadPolicy, EXTRACTION_THREAD_POLICY_AFFINITY);
});

test("physical Bandizip requires bz.exe and exact versions", () => {
  assert.throws(() => assertPhysicalBandizipPath("C:\\\\Program Files\\\\Bandizip\\\\Bandizip.exe"));
  assertPhysicalBandizipPath("C:\\\\Program Files\\\\Bandizip\\\\bz.exe");
  assert.throws(() => assertExactVersion("25.00", "26.02", "7-Zip"));
  assertExactVersion("26.02", "26.02", "7-Zip");
  assert.equal(parseSevenZipVersion("7-Zip (z) 26.02 (x64)"), "26.02");
});

test("Windows corpus extractor uses harness 7-Zip resolver not unzip-only", () => {
  const fetchSrc = readFileSync(join(import.meta.dirname, "../../bench/scripts/fetch-corpus.mjs"), "utf8");
  assert.match(fetchSrc, /resolveSevenZipConsole/);
  assert.equal(/spawnSync\("unzip"/.test(fetchSrc), false);
  const prep = readFileSync(join(import.meta.dirname, "../../bench/scripts/prepare-corpus.mjs"), "utf8");
  assert.match(prep, /resolveSevenZipConsole/);
});

test("telemetry schema supports values or explicit null reasons", () => {
  const t = emptyTelemetry("not on Windows");
  for (const k of ["wall_ms", "cpu_ms", "peak_wss_bytes", "read_bytes", "write_bytes", "exitCode", "private_usage_bytes_at_exit", "peak_private_bytes", "launcher_ok"]) {
    assert.ok(k in t);
  }
  assert.equal(t.peak_private_bytes, null);
  assert.equal(t.launcher_ok, false);
  assert.equal(t.unsupportedReason, "not on Windows");
});

test("create producer order rotates deterministically", () => {
  const p = ["7zip", "bandizip"];
  assert.deepEqual(rotateCreateProducers(p, 0), ["7zip", "bandizip"]);
  assert.deepEqual(rotateCreateProducers(p, 1), ["bandizip", "7zip"]);
  assert.deepEqual(rotateCreateProducers(p, 2), ["7zip", "bandizip"]);
  assert.deepEqual(rotateCreateProducers(p, 3), ["bandizip", "7zip"]);
});

test("fixture setup is not counted as warmup or measured stats", () => {
  const session = readFileSync(join(import.meta.dirname, "../../bench/scripts/run-physical-session.mjs"), "utf8");
  assert.match(session, /canonical-fixtures/);
  assert.match(session, /timed-create/);
  assert.match(session, /fixtureSetupRuns/);
  assert.equal(session.includes("warmup += 1"), false);
  const runs = [
    { warmup: true, valid: true, wall_ms: 9, note: "explicit warmup" },
    { warmup: false, valid: true, wall_ms: 10 },
    { warmup: false, valid: true, wall_ms: 11 },
    { warmup: false, valid: true, wall_ms: 12 },
    { warmup: false, valid: true, wall_ms: 13 },
    { warmup: false, valid: true, wall_ms: 14 },
  ];
  const measured = runs.filter((r) => !r.warmup && r.valid).map((r) => r.wall_ms);
  assert.equal(measured.length, 5);
  const s = summarizeTimes(measured);
  assert.equal(s.n, 5);
  assert.equal(measured.includes(9), false);
});

test("affinity failure cannot be reported as FIXED_AFFINITY success", () => {
  const tel = { launcher_ok: false, affinity_applied: true };
  assert.throws(() => assertAffinityNotAssumed(tel));
  assert.equal(infrastructureOk({ launcher_ok: false, wall_ms: 1, exitCode: 0, affinity_applied: true }, { requireAffinity: true }), false);
  assert.equal(infrastructureOk({ launcher_ok: true, wall_ms: 1, exitCode: 0, affinity_applied: false }, { requireAffinity: true }), false);
  assert.equal(infrastructureOk({ launcher_ok: true, wall_ms: 1, exitCode: 0, affinity_applied: true }, { requireAffinity: true }), true);
  const cpp = readFileSync(join(import.meta.dirname, "../../native/bench-run/src/main.cpp"), "utf8");
  assert.match(cpp, /if \(!SetProcessAffinityMask/);
  assert.match(cpp, /killSuspended/);
  assert.match(cpp, /kHelperAffinity/);
  const resumeIdx = cpp.indexOf("ResumeThread");
  const setIdx = cpp.indexOf("SetProcessAffinityMask");
  assert.ok(setIdx > 0 && resumeIdx > setIdx);
});

test("helper infrastructure failure is distinct from child exit", () => {
  const cpp = readFileSync(join(import.meta.dirname, "../../native/bench-run/src/main.cpp"), "utf8");
  assert.match(cpp, /launcher_ok/);
  assert.match(cpp, /helper_error/);
  const js = readFileSync(join(import.meta.dirname, "../../bench/scripts/telemetry.mjs"), "utf8");
  assert.match(js, /helperFailed/);
  assert.match(js, /childExitCode/);
});

test("PrivateUsage is not stored as peak_private_bytes", () => {
  const cpp = readFileSync(join(import.meta.dirname, "../../native/bench-run/src/main.cpp"), "utf8");
  assert.match(cpp, /private_usage_bytes_at_exit/);
  assert.equal(/appendUll\(j, "peak_private_bytes"/.test(cpp), false);
  assert.match(cpp, /peak_private_bytes/);
  const tel = emptyTelemetry("x");
  assert.equal(tel.peak_private_bytes, null);
});

test("optional telemetry failure is null plus error not zero", () => {
  const t = emptyTelemetry("GetProcessIoCounters failed");
  assert.equal(t.read_bytes, null);
  assert.equal(t.write_bytes, null);
  assert.equal(t.cpu_ms, null);
  assert.notEqual(t.read_bytes, 0);
  assert.ok(t.telemetryErrors.length >= 1);
});

test("authoritative wall timing failure invalidates the sample", () => {
  assert.equal(infrastructureOk({ launcher_ok: true, wall_ms: null, exitCode: 0, affinity_applied: true }, { requireAffinity: true }), false);
  const cpp = readFileSync(join(import.meta.dirname, "../../native/bench-run/src/main.cpp"), "utf8");
  assert.match(cpp, /kHelperQpc/);
  assert.match(cpp, /QueryPerformanceFrequency/);
});

test("physical session records create order and honest cache policy", () => {
  const session = readFileSync(join(import.meta.dirname, "../../bench/scripts/run-physical-session.mjs"), "utf8");
  assert.match(session, /createOrderByCorpus/);
  assert.match(session, /rotateCreateProducers/);
  assert.match(session, /CACHE_POLICY/);
  assert.equal(CACHE_POLICY, "hot-cache-explicit-warmup-1");
});

