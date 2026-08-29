#!/usr/bin/env node
/**
 * G1 measurement harness. GitHub/dev runs are never physical-windows.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform } from "node:os";
import { join } from "node:path";
import {
  BENCH,
  assertAuthority,
  forbidAuthoritativeGithub,
  writeJson,
} from "./common.mjs";
import { rejectGithubAsPhysical } from "./require-physical.mjs";
import { prepareCorpus } from "./prepare-corpus.mjs";
import { treeManifest } from "./tree-hash.mjs";
import { measureConfig, resolveTool } from "./measure.mjs";

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
function argList(name, fallback) {
  return arg(name, fallback).split(",").map((s) => s.trim()).filter(Boolean);
}

const authority = arg("authority", "dev-not-authoritative");
assertAuthority(authority);
rejectGithubAsPhysical(authority);
const tools = argList("tools", "7zip,lumina");
forbidAuthoritativeGithub(authority, tools);
const corpusIds = argList("corpus", "tiny");
const warmup = Number(arg("warmup", "1"));
const runsRequested = Number(arg("runs", "5"));
const threadBudget = Number(arg("threads", String(Math.min(8, cpus().length || 1))));
const op = arg("op", "zip-create");
const outRoot = join(BENCH, "out");
const cachePolicy = "hot-after-single-warmup";

const machine = {
  kind: authority,
  platform: platform(),
  logicalCores: cpus().length,
  threadBudget,
  note:
    authority === "physical-windows"
      ? "Use run-physical-session.mjs for the official session."
      : "Not a G1 competitor baseline.",
};

await mkdir(outRoot, { recursive: true });
const results = [];
for (const corpusId of corpusIds) {
  const inputDir = await prepareCorpus(corpusId, outRoot);
  const sourceManifest = await treeManifest(inputDir);
  for (const toolId of tools) {
    const tool = await resolveTool(toolId);
    results.push(
      await measureConfig({
        authority,
        machine,
        threadBudget,
        warmup,
        runsRequested,
        tool,
        corpusId,
        corpusDir: inputDir,
        op,
        workRoot: outRoot,
        sourceManifest,
        cachePolicy,
      }),
    );
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = join(outRoot, `g1-${authority}-${stamp}.json`);
await writeJson(outFile, { authority, threadBudget, cachePolicy, results });
await writeFile(join(outRoot, "latest.json"), JSON.stringify({ authority, threadBudget, cachePolicy, results }, null, 2));
console.log(outFile);
if (authority !== "physical-windows") console.log("AUTHORITY: not G1 competitor baseline");
