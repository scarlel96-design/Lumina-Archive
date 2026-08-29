import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { treeManifest, manifestsEqual } from "../../bench/scripts/tree-hash.mjs";
import { extractDestPath, extractArgs, createArgs } from "../../bench/scripts/fixtures.mjs";
import { assertPhysicalBandizipPath, assertExactVersion, parseSevenZipVersion, parseBandizipVersion, parseBandizipBanner } from "../../bench/scripts/versions-detect.mjs";
import { extractionPolicy, EXTRACTION_THREAD_POLICY_AUTO, EXTRACTION_THREAD_POLICY_AFFINITY, assertNoFalseExtractThreads } from "../../bench/scripts/thread-policy.mjs";
import { emptyTelemetry, infrastructureOk } from "../../bench/scripts/telemetry.mjs";
import { rotateCreateProducers, CACHE_POLICY, assertAffinityNotAssumed } from "../../bench/scripts/thread-policy.mjs";
import { summarizeTimes } from "../../bench/scripts/stats.mjs";
import { verificationSpawnOpts, decideCreateValid } from "../../bench/scripts/measure.mjs";
import { validatePhysicalSession, PINNED_SILESIA } from "../../bench/scripts/accept-baseline.mjs";
import { statusNote, renderResultsMd } from "../../bench/scripts/render-results.mjs";

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
  assert.equal(parseSevenZipVersion("7-Zip 26.02 (x64) : Copyright (c) 1999-2026 Igor Pavlov : 2026-06-25"), "26.02");
});

test("parses the real physical bz.exe 7.46 Beta banner", () => {
  const real = readFileSync(join(import.meta.dirname, "../../bench/fixtures/bz-7.46-banner.txt"), "utf8");
  assert.equal(
    real.trim(),
    "bz 7.46(Beta,x64) - Bandizip console tool. Copyright (C) 2026 Bandisoft",
  );
  assert.equal(parseBandizipVersion(real), "7.46");
  const parsed = parseBandizipBanner(real);
  assert.equal(parsed.detected, "7.46");
  assert.equal(parsed.versionQualifier, "Beta");
  assert.equal(parsed.architectureQualifier, "x64");
});

test("Bandizip banner forms yield 7.46", () => {
  for (const s of [
    "bz 7.46(Beta,x64) - Bandizip console tool. Copyright (C) 2026 Bandisoft",
    "bz 7.46(x64)",
    "bz 7.46",
    "Bandizip 7.46",
    "Bandizip v7.46",
    "Bandizip.com 7.46",
  ]) {
    assert.equal(parseBandizipVersion(s), "7.46", s);
  }
});

test("Bandizip parser does not accept arbitrary 7.46 text", () => {
  for (const s of [
    "Copyright 2026",
    "version 7.46",
    "some-tool 7.46",
    "7.46",
    "error 7.46",
    "random Bandizip text without a valid banner",
  ]) {
    assert.equal(parseBandizipVersion(s), null, s);
  }
  assert.throws(() => assertExactVersion("7.45", "7.46", "Bandizip"));
  assert.throws(() => assertExactVersion("7.47", "7.46", "Bandizip"));
  assert.throws(() => assertExactVersion(null, "7.46", "Bandizip"));
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

test("post-create verification must not use affinity mask 0", () => {
  const opts = verificationSpawnOpts({ helper: "lumina-bench-run.exe", threadBudget: 8, authoritative: true });
  assert.notEqual(opts.affinityMask, "0");
  assert.ok(opts.affinityMask && opts.affinityMask !== "0");
  assert.equal(opts.requireAffinity, true);
  const src = readFileSync(join(import.meta.dirname, "../../bench/scripts/measure.mjs"), "utf8");
  assert.match(src, /verificationSpawnOpts/);
  assert.equal(/extractArgs\([^;]+runDir,\s*\{\s*helper\s*\}/.test(src), false);
});

test("create sample valid only after verification tree match", () => {
  assert.equal(decideCreateValid({ createOk: true, verifyInfraOk: true, verifyExit0: true, treeMatch: true }), true);
  assert.equal(decideCreateValid({ createOk: true, verifyInfraOk: false, verifyExit0: true, treeMatch: true }), false);
  assert.equal(decideCreateValid({ createOk: true, verifyInfraOk: true, verifyExit0: false, treeMatch: true }), false);
  assert.equal(decideCreateValid({ createOk: true, verifyInfraOk: true, verifyExit0: true, treeMatch: false }), false);
});

function rec(over) {
  return {
    schema: "lumina.bench.v1",
    authority: "physical-windows",
    runsRequested: 5,
    tool: { id: "7zip", version: "26.02" },
    corpus: { id: "tiny" },
    op: "zip-create",
    skipped: false,
    runs: [
      { warmup: true, valid: true },
      { warmup: false, valid: true },
      { warmup: false, valid: true },
      { warmup: false, valid: true },
      { warmup: false, valid: true },
      { warmup: false, valid: true },
    ],
    summary: { n: 5, measuredValid: 5, incomplete: false, hash_ok: true },
    ...over,
  };
}

test("invalid mandatory configuration rejects G1-BASELINE", () => {
  const session = { authority: "physical-windows" };
  const bad = rec({ summary: { n: 0, measuredValid: 0, incomplete: true, hash_ok: false } });
  const v = validatePhysicalSession({ session, results: [bad], silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
  assert.ok(v.reasons.length > 0);
  const good = rec({});
  const ok = validatePhysicalSession({ session, results: [good], silesiaSha256: PINNED_SILESIA });
  assert.equal(ok.accepted, true);
});

test("RESULTS.md renders once from all.json and labels INCOMPLETE", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lumina-r-"));
  const incomplete = rec({
    summary: { n: 0, measuredValid: 0, incomplete: true, hash_ok: false, median: null, p95: null },
  });
  assert.equal(statusNote(incomplete), "INCOMPLETE");
  const session = { id: "t", authority: "physical-windows", cachePolicy: "hot-cache-explicit-warmup-1", threadBudget: 8 };
  await writeFile(join(dir, "all.json"), JSON.stringify({ session, results: [incomplete] }));
  await writeFile(join(dir, "7zip-tiny-zip-create.json"), JSON.stringify(incomplete));
  await renderResultsMd(dir, session, { writeRepoCopy: false });
  const md = readFileSync(join(dir, "RESULTS.md"), "utf8");
  const hits = md.split("INCOMPLETE").length - 1;
  assert.equal(hits, 1);
  assert.equal(/\| ok \|/.test(md), false);
  await rm(dir, { recursive: true, force: true });
});
