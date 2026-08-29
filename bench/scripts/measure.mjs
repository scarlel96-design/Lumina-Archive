import { join, dirname } from "node:path";
import { sha256File, fileSize } from "./common.mjs";
import { treeManifest, manifestsEqual } from "./tree-hash.mjs";
import { summarizeTimes } from "./stats.mjs";
import { spawnTimed, resolveBenchRunner, emptyTelemetry, infrastructureOk } from "./telemetry.mjs";
import { resolveTool, rotateTools } from "./measure-resolve.mjs";
import { createArgs, extractArgs, extractDestPath, ensureCleanDir, createCanonicalFixture } from "./fixtures.mjs";
import { affinityMask, extractionPolicy, COMPRESSION_THREAD_POLICY, rotateCreateProducers } from "./thread-policy.mjs";

export { resolveTool, rotateTools, extractDestPath, createCanonicalFixture, ensureCleanDir, rotateCreateProducers };
export { findCached, resolveSevenZipConsole } from "./measure-resolve.mjs";


export function buildArgs(tool, opName, archive, inputDir, threadBudget, destDir) {
  if (opName.endsWith("extract")) return extractArgs(tool, archive, destDir);
  const format = opName.startsWith("7z") ? "7z" : "zip";
  if (opName.endsWith("create")) {
    return createArgs(tool, archive, ["."], threadBudget, format);
  }
  if (opName.endsWith("test")) return tool.kind === "bandizip" ? ["t", archive] : ["t", archive];
  if (opName.endsWith("list")) return ["l", archive];
  throw new Error(`no argv for ${tool.id} ${opName}`);
}

export async function measureCreate({
  authority,
  machine,
  threadBudget,
  warmup,
  runsRequested,
  tool,
  corpusId,
  corpusDir,
  format,
  workRoot,
  sourceManifest,
  cachePolicy,
  helper,
}) {
  const op = format === "7z" ? "7z-create" : "zip-create";
  const record = baseRecord({ authority, machine, threadBudget, warmup, runsRequested, tool, corpusId, op, cachePolicy });
  record.compressionThreadPolicy = COMPRESSION_THREAD_POLICY;
  if (skipTool(tool, record)) return record;
  const files = sourceManifest.files.map((f) => f.path);
  const total = warmup + runsRequested;
  const times = [];
  let outputBytes = null;
  const authoritative = authority === "physical-windows";
  for (let i = 0; i < total; i++) {
    const isWarm = i < warmup;
    const runDir = join(workRoot, "create", tool.id, corpusId, format, `run-${i}`);
    await ensureCleanDir(runDir);
    const archive = join(runDir, format === "7z" ? "out.7z" : "out.zip");
    const argv = createArgs(tool, archive, files, threadBudget, format);
    record.argv = argv;
    const run = await spawnTimed(tool.path, argv, corpusDir, {
      helper,
      affinityMask: affinityMask(threadBudget),
      authoritative,
      requireAffinity: authoritative,
    });
    let valid = sampleOk(run, authoritative) && run.exitCode === 0;
    let hash_ok = null;
    const bytes = valid ? await fileSize(archive) : null;
    if (valid && bytes) {
      await sha256File(archive);
      outputBytes = bytes;
      const dest = join(runDir, "verify-x");
      await ensureCleanDir(dest);
      const xRun = await spawnTimed(tool.path, extractArgs(tool, archive, dest), runDir, { helper });
      if (xRun.exitCode !== 0) valid = false;
      else {
        hash_ok = manifestsEqual(sourceManifest, await treeManifest(dest));
        valid = hash_ok;
      }
    } else valid = false;
    if (!isWarm && valid) times.push(run.wall_ms);
    record.runs.push(runRow(i, isWarm, run, bytes, hash_ok, valid));
  }
  record.summary = summarize(times, sourceManifest, outputBytes, record);
  return record;
}

export async function measureExtract({
  authority,
  machine,
  threadBudget,
  warmup,
  runsRequested,
  tool,
  corpusId,
  fixture,
  workRoot,
  sourceManifest,
  cachePolicy,
  helper,
}) {
  const format = fixture.format;
  const op = format === "7z" ? "7z-extract" : "zip-extract";
  const record = baseRecord({ authority, machine, threadBudget, warmup, runsRequested, tool, corpusId, op, cachePolicy });
  record.fixture = fixture;
  record.archiveSha256 = fixture.archiveSha256;
  const policy = extractionPolicy(helper);
  record.extractionThreadPolicy = policy.extractionThreadPolicy;
  record.claimedFixedExtractThreads = policy.usesFixedThreadBudget;
  record.compressionThreadPolicy = null;
  if (skipTool(tool, record)) return record;
  const total = warmup + runsRequested;
  const times = [];
  const fixtureId = `${fixture.format}-by-${fixture.producer}`;
  const authoritative = authority === "physical-windows";
  for (let i = 0; i < total; i++) {
    const isWarm = i < warmup;
    const dest = extractDestPath(workRoot, fixtureId, tool.id, i);
    await ensureCleanDir(dest);
    const argv = extractArgs(tool, fixture.archive, dest);
    record.argv = argv;
    const run = await spawnTimed(tool.path, argv, dirname(fixture.archive), {
      helper,
      affinityMask: policy.usesFixedThreadBudget ? affinityMask(threadBudget) : "0",
      authoritative,
      requireAffinity: authoritative && policy.usesFixedThreadBudget,
    });
    let valid = sampleOk(run, authoritative) && run.exitCode === 0;
    let hash_ok = false;
    if (valid) {
      hash_ok = manifestsEqual(sourceManifest, await treeManifest(dest));
      valid = hash_ok;
    }
    if (!isWarm && valid) times.push(run.wall_ms);
    record.runs.push(runRow(i, isWarm, run, fixture.archiveBytes, hash_ok, valid));
  }
  record.summary = summarize(times, sourceManifest, fixture.archiveBytes, record);
  return record;
}

function baseRecord({ authority, machine, threadBudget, warmup, runsRequested, tool, corpusId, op, cachePolicy }) {
  return {
    schema: "lumina.bench.v1",
    authority,
    machine,
    threadBudget,
    warmup,
    runsRequested,
    cachePolicy,
    tool: { id: tool.id, version: tool.detectedVersion || tool.version, path: tool.path || "" },
    corpus: { id: corpusId },
    op,
    skipped: false,
    runs: [],
    summary: {},
    argv: null,
  };
}

function sampleOk(run, authoritative) {
  if (!authoritative) return true;
  if (run.helperFailed) return false;
  return infrastructureOk(run.telemetry, { requireAffinity: true });
}

function skipTool(tool, record) {
  if (tool.id === "lumina") {
    record.skipped = true;
    record.skipReason = "SKIPPED_NOT_LINKED";
    return true;
  }
  if (!tool.path) {
    record.skipped = true;
    record.skipReason = `${tool.id} binary not found (Bandizip/NanaZip stay outside the repo)`;
    return true;
  }
  return false;
}

function runRow(index, warmup, run, output_bytes, hash_ok, valid) {
  const tel = run.telemetry || emptyTelemetry("plain spawn");
  return {
    index,
    warmup,
    wall_ms: run.wall_ms,
    cpu_ms: tel.cpu_ms,
    peak_wss_bytes: tel.peak_wss_bytes,
    peak_private_bytes: null,
    private_usage_bytes_at_exit: tel.private_usage_bytes_at_exit ?? null,
    launcher_ok: tel.launcher_ok === true,
    helperFailed: run.helperFailed === true,
    read_bytes: tel.read_bytes,
    write_bytes: tel.write_bytes,
    output_bytes,
    exitCode: run.exitCode,
    hash_ok,
    valid,
    telemetry: tel,
  };
}

function summarize(times, sourceManifest, outputBytes, record) {
  const stats = summarizeTimes(times);
  const inputBytes = sourceManifest?.files.reduce((a, f) => a + f.bytes, 0) ?? null;
  const measured = record.runs.filter((r) => !r.warmup);
  const validMeasured = measured.filter((r) => r.valid === true);
  return {
    ...stats,
    output_bytes: outputBytes,
    throughputMBps: stats.median && inputBytes ? inputBytes / 1e6 / (stats.median / 1000) : null,
    hash_ok: validMeasured.length === record.runsRequested && validMeasured.every((r) => r.valid === true),
    measuredValid: validMeasured.length,
    incomplete: validMeasured.length < record.runsRequested,
  };
}

/** Smoke path used by run-harness.mjs (non-physical). */
export async function measureConfig(opts) {
  const helper = opts.helper || (await resolveBenchRunner());
  if (opts.op?.includes("extract") && opts.fixture) {
    return measureExtract({ ...opts, helper });
  }
  if (opts.op?.includes("extract")) {
    throw new Error("extract requires a canonical fixture (same archive bytes for every extractor)");
  }
  const format = opts.op?.startsWith("7z") ? "7z" : "zip";
  if (opts.op?.includes("create")) {
    return measureCreate({ ...opts, format, helper });
  }
  const tool = opts.tool;
  const record = baseRecord({ ...opts, op: opts.op });
  if (skipTool(tool, record)) return record;
  const argv = opts.op?.includes("test") ? ["t", opts.archive] : ["l", opts.archive];
  const run = await spawnTimed(tool.path, argv, opts.corpusDir, { helper });
  record.argv = argv;
  record.runs.push(runRow(0, false, run, null, null, run.exitCode === 0));
  record.summary = summarize(
    run.exitCode === 0 ? [run.wall_ms] : [],
    opts.sourceManifest,
    null,
    record,
  );
  return record;
}
