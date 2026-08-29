#!/usr/bin/env node
/**
 * Authoritative G1 competitor baseline. Refuses GitHub Actions and non-Windows.
 * Lumina is SKIPPED_NOT_LINKED. Does not start G2.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { BENCH, ROOT, readJson, writeJson } from "./common.mjs";
import { rejectGithubAsPhysical, assertPhysicalMachine } from "./require-physical.mjs";
import { prepareCorpus } from "./prepare-corpus.mjs";
import { treeManifest } from "./tree-hash.mjs";
import { measureConfig, resolveTool, rotateTools } from "./measure.mjs";
import { renderResultsMd } from "./render-results.mjs";

const authority = "physical-windows";
rejectGithubAsPhysical(authority);

const machinePath = join(BENCH, "machine.local.json");
const machine = await readJson(machinePath);
assertPhysicalMachine(machine);
const threadBudget = machine.threadBudget;
const warmup = 1;
const runsRequested = 5;
const cachePolicy = "hot-after-single-warmup";
const corpora = ["tiny", "silesia", "incompressible-64m"];
const ops = ["zip-create", "zip-extract", "7z-create", "7z-extract", "zip-test"];
const toolIds = ["7zip", "bandizip", "nanazip", "lumina"];

const seven = await resolveTool("7zip");
const bandi = await resolveTool("bandizip");
if (!seven.path) throw new Error("7-Zip 26.02 executable not found");
if (!bandi.path) throw new Error("Bandizip 7.46 executable not found (must stay outside the repo)");

const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
const harnessCommit = (git.stdout || "").trim();
const sessionId = `g1-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const sessionDir = join(BENCH, "results", sessionId);
await mkdir(sessionDir, { recursive: true });

const session = {
  id: sessionId,
  authority,
  started: new Date().toISOString(),
  harnessCommit,
  threadBudget,
  warmup,
  runsRequested,
  cachePolicy,
  corpora,
  ops,
  machine: { ...machine },
};
await writeJson(join(sessionDir, "session.json"), session);

const outRoot = join(BENCH, "out", sessionId);
const all = [];
for (let ci = 0; ci < corpora.length; ci++) {
  const corpusId = corpora[ci];
  const corpusDir = await prepareCorpus(corpusId, outRoot);
  const sourceManifest = await treeManifest(corpusDir);
  const rotated = rotateTools(toolIds, ci);
  for (const toolId of rotated) {
    const tool = await resolveTool(toolId);
    for (const op of ops) {
      if (toolId === "lumina") {
        const rec = await measureConfig({
          authority, machine, threadBudget, warmup, runsRequested, tool, corpusId, corpusDir, op, workRoot: outRoot, sourceManifest, cachePolicy,
        });
        all.push(rec);
        continue;
      }
      if (toolId === "nanazip" && !tool.path) {
        all.push({
          schema: "lumina.bench.v1",
          authority,
          tool: { id: "nanazip", version: "6.5.1800", path: "" },
          corpus: { id: corpusId },
          op,
          skipped: true,
          skipReason: "NanaZip optional — absence does not fail G1",
        });
        continue;
      }
      const rec = await measureConfig({
        authority, machine, threadBudget, warmup, runsRequested, tool, corpusId, corpusDir, op, workRoot: outRoot, sourceManifest, cachePolicy,
      });
      all.push(rec);
      await writeJson(join(sessionDir, `${toolId}-${corpusId}-${op}.json`), rec);
    }
  }
}

session.ended = new Date().toISOString();
await writeJson(join(sessionDir, "session.json"), session);
await writeJson(join(sessionDir, "all.json"), { session, results: all });
await renderResultsMd(sessionDir, session);

const fingerprintSrc = {
  cpu: machine.cpu,
  storage: machine.storage,
  windowsBuild: machine.windowsBuild,
  ramGiB: machine.ramGiB,
  threadBudget,
  cachePolicy,
  schema: "lumina.bench.v1",
  silesia: (await readJson(join(ROOT, "eng/corpus-pins.json"))).silesiaZip.sha256,
  tools: { sevenZip: "26.02", bandizip: "7.46" },
};
const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintSrc)).digest("hex");
const freeze = {
  baselineId: `G1-${sessionId}`,
  machineFingerprint: fingerprint,
  corpusPins: "eng/corpus-pins.json",
  toolVersions: { sevenZip: "26.02", bandizip: "7.46", nanaZip: "6.5.1800-optional" },
  threadBudget,
  resultSchema: "lumina.bench.v1",
  harnessCommit,
  silesiaSha256: fingerprintSrc.silesia,
  sessionId,
  authority,
};
await writeJson(join(sessionDir, "G1-BASELINE.json"), freeze);
await writeJson(join(BENCH, "G1-BASELINE.json"), freeze);
console.log(sessionDir);
