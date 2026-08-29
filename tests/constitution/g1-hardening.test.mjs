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
import { emptyTelemetry } from "../../bench/scripts/telemetry.mjs";


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
  for (const k of ["wall_ms", "cpu_ms", "peak_wss_bytes", "read_bytes", "write_bytes", "exitCode"]) {
    assert.ok(k in t);
  }
  assert.equal(t.unsupportedReason, "not on Windows");
});
