import { spawn } from "node:child_process";
import { access, constants, mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, delimiter, dirname } from "node:path";
import { ROOT, sha256File, fileSize } from "./common.mjs";
import { parse7zip, parseNanaZip, parseBandizip, parseLumina, rejectSecretArgv } from "./parsers.mjs";
import { treeManifest, manifestsEqual } from "./tree-hash.mjs";
import { summarizeTimes } from "./stats.mjs";

export async function findCached(names) {
  const root = join(ROOT, "vendor/cache");
  const want = new Set(names);
  async function walk(dir, depth) {
    if (depth > 4) return null;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isFile() && want.has(e.name)) return p;
      if (e.isDirectory()) {
        const hit = await walk(p, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }
  return walk(root, 0);
}

async function which(names) {
  const dirs = (process.env.PATH || "").split(delimiter);
  for (const n of names) {
    for (const c of [n, ...dirs.map((d) => join(d, n))]) {
      try {
        await access(c, constants.F_OK);
        return c;
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

export async function resolveTool(id) {
  if (id === "7zip") {
    const path =
      process.env.LUMINA_7ZIP ||
      (await findCached(["7zz", "7za.exe", "7z.exe", "7za", "7z"])) ||
      (await which(["7zz", "7za", "7z", "7za.exe", "7z.exe", "7zz.exe"]));
    return { id, version: "26.02", path, kind: "7zip" };
  }
  if (id === "nanazip") {
    const path = process.env.LUMINA_NANAZIP || (await which(["NanaZip.Core.exe", "NanaZip.exe"]));
    return { id, version: "6.5.1800", path, kind: "nanazip" };
  }
  if (id === "bandizip") {
    const guesses = [
      process.env.LUMINA_BANDIZIP,
      "C:\\Program Files\\Bandizip\\bz.exe",
      "C:\\Program Files\\Bandizip\\Bandizip.exe",
      join(homedir(), "AppData/Local/Bandizip/bz.exe"),
    ].filter(Boolean);
    let path = null;
    for (const g of guesses) {
      try {
        await access(g, constants.F_OK);
        path = g;
        break;
      } catch {
        /* skip */
      }
    }
    return { id, version: "7.46", path, kind: "bandizip" };
  }
  if (id === "lumina") {
    return { id, version: "0.0.0-g1", path: null, kind: "lumina" };
  }
  throw new Error(`unknown tool ${id}`);
}

export function buildArgs(tool, opName, archive, inputDir, threadBudget) {
  const mmt = String(threadBudget);
  const outDir = join(dirname(archive), "x");
  if (tool.kind === "7zip" || tool.kind === "nanazip") {
    if (opName === "zip-create") return ["a", "-tzip", "-mx=1", `-mmt=${mmt}`, "-y", archive, inputDir];
    if (opName === "zip-extract") return ["x", `-mmt=${mmt}`, "-y", archive, `-o${outDir}`];
    if (opName === "zip-test") return ["t", archive];
    if (opName === "zip-list") return ["l", archive];
    if (opName === "7z-create") return ["a", "-t7z", "-mx=5", `-mmt=${mmt}`, "-y", archive, inputDir];
    if (opName === "7z-extract") return ["x", `-mmt=${mmt}`, "-y", archive, `-o${outDir}`];
  }
  if (tool.kind === "bandizip") {
    if (opName === "zip-create") return ["c", "-l:1", "-aoa", `-t:${mmt}`, "-fmt:zip", "-y", archive, inputDir];
    if (opName === "zip-extract") return ["x", "-aoa", "-y", `-o:${outDir}`, archive];
    if (opName === "zip-test") return ["t", archive];
    if (opName === "zip-list") return ["l", archive];
    if (opName === "7z-create") return ["c", "-l:5", "-aoa", `-t:${mmt}`, "-fmt:7z", "-y", archive, inputDir];
    if (opName === "7z-extract") return ["x", "-aoa", "-y", `-o:${outDir}`, archive];
  }
  throw new Error(`no argv for ${tool.id} ${opName}`);
}

export function spawnTimed(command, argv, cwd) {
  rejectSecretArgv([command, ...argv]);
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(command, argv, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      resolve({
        exitCode: 127,
        stdout,
        stderr: stderr + err.message,
        wall_ms: Number(process.hrtime.bigint() - started) / 1e6,
        argv: [command, ...argv],
      });
    });
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 127,
        stdout,
        stderr,
        wall_ms: Number(process.hrtime.bigint() - started) / 1e6,
        argv: [command, ...argv],
      });
    });
  });
}

function parseTool(tool, stdout, stderr, exitCode) {
  if (tool.kind === "7zip") return parse7zip(stdout, stderr);
  if (tool.kind === "nanazip") return parseNanaZip(stdout, stderr);
  if (tool.kind === "bandizip") return parseBandizip(stdout, stderr, exitCode);
  return parseLumina(stdout, stderr, exitCode);
}

export function rotateTools(tools, corpusIndex) {
  const k = corpusIndex % tools.length;
  return [...tools.slice(k), ...tools.slice(0, k)];
}

export async function measureConfig({
  authority,
  machine,
  threadBudget,
  warmup,
  runsRequested,
  tool,
  corpusId,
  corpusDir,
  op,
  workRoot,
  sourceManifest,
  cachePolicy,
}) {
  const record = {
    schema: "lumina.bench.v1",
    authority,
    machine,
    threadBudget,
    warmup,
    runsRequested,
    cachePolicy,
    tool: { id: tool.id, version: tool.version, path: tool.path || "" },
    corpus: { id: corpusId },
    op,
    skipped: false,
    runs: [],
    summary: {},
    argv: null,
  };

  if (tool.id === "lumina") {
    record.skipped = true;
    record.skipReason = "SKIPPED_NOT_LINKED";
    return record;
  }
  if (!tool.path) {
    record.skipped = true;
    record.skipReason = `${tool.id} binary not found (Bandizip/NanaZip stay outside the repo)`;
    return record;
  }

  const total = warmup + runsRequested;
  const times = [];
  let outputBytes = null;
  const work = join(workRoot, tool.id, corpusId, op);
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });

  for (let i = 0; i < total; i++) {
    const isWarm = i < warmup;
    const runDir = join(work, String(i));
    await mkdir(runDir, { recursive: true });
    const archive = join(runDir, op.startsWith("7z") ? "out.7z" : "out.zip");
    let argv;
    let run;
    if (op.endsWith("extract") || op.endsWith("test") || op.endsWith("list")) {
      const created = join(work, "shared-archive" + (op.startsWith("7z") ? ".7z" : ".zip"));
      if (i === 0) {
        const createOp = op.startsWith("7z") ? "7z-create" : "zip-create";
        const cArgv = buildArgs(tool, createOp, created, corpusDir, threadBudget);
        const cRun = await spawnTimed(tool.path, cArgv, runDir);
        if (cRun.exitCode !== 0) {
          record.runs.push({ index: i, warmup: isWarm, wall_ms: cRun.wall_ms, exitCode: cRun.exitCode, valid: false, note: "create-for-extract-failed" });
          continue;
        }
      }
      argv = buildArgs(tool, op, created, corpusDir, threadBudget);
      run = await spawnTimed(tool.path, argv, runDir);
    } else {
      argv = buildArgs(tool, op, archive, corpusDir, threadBudget);
      run = await spawnTimed(tool.path, argv, runDir);
    }
    record.argv = argv;
    const parsed = parseTool(tool, run.stdout, run.stderr, run.exitCode);
    const bytes = await fileSize(archive);
    let valid = run.exitCode === 0;
    let hash_ok = null;
    if (valid && bytes) {
      await sha256File(archive);
      outputBytes = bytes;
    }
    if (valid && op.endsWith("create") && sourceManifest) {
      const outDir = join(runDir, "x");
      const extractOp = op.startsWith("7z") ? "7z-extract" : "zip-extract";
      const xArgv = buildArgs(tool, extractOp, archive, corpusDir, threadBudget);
      const xRun = await spawnTimed(tool.path, xArgv, runDir);
      if (xRun.exitCode !== 0) valid = false;
      else {
        const got = await treeManifest(outDir);
        hash_ok = manifestsEqual(sourceManifest, got);
        valid = hash_ok;
      }
    }
    if (!isWarm && valid) times.push(run.wall_ms);
    record.runs.push({
      index: i,
      warmup: isWarm,
      wall_ms: run.wall_ms,
      cpu_ms: null,
      peak_wss_bytes: null,
      output_bytes: bytes,
      exitCode: run.exitCode,
      hash_ok,
      valid,
      parsed,
    });
  }

  const stats = summarizeTimes(times);
  const inputBytes = sourceManifest?.files.reduce((a, f) => a + f.bytes, 0) ?? null;
  record.summary = {
    ...stats,
    output_bytes: outputBytes,
    throughputMBps:
      stats.median && inputBytes ? inputBytes / 1e6 / (stats.median / 1000) : null,
    hash_ok: record.runs.filter((r) => !r.warmup).every((r) => r.valid !== false),
  };
  return record;
}
