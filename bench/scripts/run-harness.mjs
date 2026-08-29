#!/usr/bin/env node
/**
 * G1 measurement harness. Does not optimize codecs. Does not compare Bandizip
 * on GitHub-hosted runners as product evidence.
 */
import { spawn } from "node:child_process";
import { access, constants, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, delimiter, dirname } from "node:path";
import { cpus, platform } from "node:os";
import {
  BENCH,
  ROOT,
  assertAuthority,
  forbidAuthoritativeGithub,
  median,
  p95,
  sha256File,
  fileSize,
  writeJson,
} from "./common.mjs";
import { parse7zip, parseNanaZip, parseBandizip, parseLumina, rejectSecretArgv } from "./parsers.mjs";
import { prepareCorpus } from "./prepare-corpus.mjs";

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function argList(name, fallback) {
  return arg(name, fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const authority = arg("authority", "dev-not-authoritative");
assertAuthority(authority);
const tools = argList("tools", "7zip,lumina");
forbidAuthoritativeGithub(authority, tools);

const corpusIds = argList("corpus", "tiny");
const warmup = Number(arg("warmup", "1"));
const runsRequested = Number(arg("runs", "5"));
const threadBudget = Number(arg("threads", String(Math.min(8, cpus().length || 1))));
const op = arg("op", "zip-create");
const outRoot = join(BENCH, "out");

async function findCached(names) {
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
    const candidates = [n, ...dirs.map((d) => join(d, n))];
    for (const c of candidates) {
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

async function resolveTool(id) {
  if (id === "7zip") {
    const path =
      process.env.LUMINA_7ZIP ||
      (await findCached(["7zz", "7za.exe", "7z.exe", "7za", "7z"])) ||
      (await which(["7zz", "7za", "7z", "7za.exe", "7z.exe", "7zz.exe"]));
    return { id, version: "26.02", path, kind: "7zip" };
  }
  if (id === "nanazip") {
    const path =
      process.env.LUMINA_NANAZIP ||
      (await which(["NanaZip.Core.exe", "NanaZip.exe"]));
    return { id, version: "6.5.1800", path, kind: "nanazip" };
  }
  if (id === "bandizip") {
    const guesses = [
      process.env.LUMINA_BANDIZIP,
      "C:\\Program Files\\Bandizip\\Bandizip.exe",
      "C:\\Program Files\\Bandizip\\bc.exe",
      join(homedir(), "AppData/Local/Bandizip/Bandizip.exe"),
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
    const path =
      process.env.LUMINA_CLI ||
      join(ROOT, "apps/cli/bin/Release/net10.0/Lumina.Cli.dll");
    return { id, version: "0.0.0-g1", path, kind: "lumina" };
  }
  throw new Error(`unknown tool ${id}`);
}

function buildArgs(tool, opName, archive, inputDir) {
  const mmt = String(threadBudget);
  if (tool.kind === "7zip" || tool.kind === "nanazip") {
    if (opName === "zip-create") return ["a", "-tzip", "-mx=1", `-mmt=${mmt}`, "-y", archive, inputDir];
    if (opName === "zip-extract") return ["x", `-mmt=${mmt}`, "-y", archive, `-o${join(dirname(archive), "x")}`];
    if (opName === "zip-test") return ["t", archive];
    if (opName === "7z-create") return ["a", "-t7z", "-mx=5", `-mmt=${mmt}`, "-y", archive, inputDir];
  }
  if (tool.kind === "bandizip") {
    if (opName === "zip-create") return ["c", "-y", archive, inputDir];
    if (opName === "zip-extract") return ["x", "-y", archive, `${inputDir}-out`];
    if (opName === "zip-test") return ["t", archive];
  }
  if (tool.kind === "lumina") {
    return ["--bench-identity"];
  }
  throw new Error(`no argv for ${tool.id} ${opName}`);
}

function spawnTimed(command, argv, cwd) {
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
      });
    });
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 127,
        stdout,
        stderr,
        wall_ms: Number(process.hrtime.bigint() - started) / 1e6,
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

await mkdir(outRoot, { recursive: true });
const machine = {
  kind: authority === "physical-windows" ? "physical-windows" : authority,
  platform: platform(),
  logicalCores: cpus().length,
  threadBudget,
  note:
    authority === "physical-windows"
      ? "Authoritative vs Bandizip only when Defender/power/SSD fields are filled on a fixed PC."
      : "Not evidence for Bandizip-vs-Lumina claims.",
};

const results = [];

for (const corpusId of corpusIds) {
  const inputDir = await prepareCorpus(corpusId, outRoot);
  for (const toolId of tools) {
    const tool = await resolveTool(toolId);
    const record = {
      schema: "lumina.bench.v1",
      authority,
      machine,
      threadBudget,
      warmup,
      runsRequested,
      tool: { id: tool.id, version: tool.version, path: tool.path || "" },
      corpus: { id: corpusId },
      op,
      skipped: false,
      runs: [],
      summary: {},
    };

    if (!tool.path && tool.id !== "lumina") {
      record.skipped = true;
      record.skipReason = `${tool.id} binary not found (Bandizip/NanaZip stay outside the repo)`;
      results.push(record);
      continue;
    }

    if (tool.id === "lumina") {
      record.skipped = true;
      record.skipReason = "G1: lumina-engine codecs are not linked";
      results.push(record);
      continue;
    }

    const total = warmup + runsRequested;
    for (let i = 0; i < total; i++) {
      const isWarm = i < warmup;
      const work = join(outRoot, "work", tool.id, corpusId, String(i));
      await rm(work, { recursive: true, force: true });
      await mkdir(work, { recursive: true });
      const archive = join(work, op === "7z-create" ? "out.7z" : "out.zip");
      const argv = buildArgs(tool, op, archive, inputDir);
      const run = await spawnTimed(tool.path, argv, work);
      const parsed = parseTool(tool, run.stdout, run.stderr, run.exitCode);
      let hash_ok = null;
      const output_bytes = await fileSize(archive);
      if (output_bytes && run.exitCode === 0) {
        await sha256File(archive);
        hash_ok = parsed.ok;
      }
      record.runs.push({
        index: i,
        warmup: isWarm,
        wall_ms: run.wall_ms,
        cpu_ms: null,
        peak_wss_bytes: null,
        output_bytes,
        exitCode: run.exitCode,
        hash_ok,
        parsed,
      });
    }

    const timed = record.runs.filter((r) => !r.warmup && r.exitCode === 0).map((r) => r.wall_ms);
    record.summary = {
      n: timed.length,
      median_ms: median(timed),
      p95_ms: p95(timed),
      mbps: null,
      hash_ok: record.runs.filter((r) => !r.warmup).every((r) => r.hash_ok !== false),
    };
    results.push(record);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = join(outRoot, `g1-${authority}-${stamp}.json`);
await writeJson(outFile, { authority, threadBudget, results });
await writeFile(join(outRoot, "latest.json"), JSON.stringify({ authority, threadBudget, results }, null, 2));
console.log(outFile);
if (authority !== "physical-windows") {
  console.log("AUTHORITY: not evidence for Bandizip-vs-Lumina");
}
