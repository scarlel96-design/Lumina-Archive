#!/usr/bin/env node
/**
 * Authoritative G1 competitor baseline. Refuses GitHub Actions and non-Windows.
 * Extraction uses canonical fixtures (same bytes for every extractor).
 * Lumina is SKIPPED_NOT_LINKED. Does not start G2.
 */
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { BENCH, ROOT, readJson, writeJson } from "./common.mjs";
import { rejectGithubAsPhysical, assertPhysicalMachine } from "./require-physical.mjs";
import { prepareCorpus } from "./prepare-corpus.mjs";
import { treeManifest } from "./tree-hash.mjs";
import { measureCreate, measureExtract, rotateTools } from "./measure.mjs";
import { resolveTool } from "./measure-resolve.mjs";
import { createCanonicalFixture } from "./fixtures.mjs";
import { resolveBenchRunner } from "./telemetry.mjs";
import { assertPhysicalTools, detectInstalledVersion } from "./versions-detect.mjs";
import { EXTRACTION_THREAD_POLICY_AFFINITY } from "./thread-policy.mjs";
import { renderResultsMd } from "./render-results.mjs";

const authority = "physical-windows";
rejectGithubAsPhysical(authority);

const machine = await readJson(join(BENCH, "machine.local.json"));
assertPhysicalMachine(machine);
const helper = await resolveBenchRunner();
if (!helper) throw new Error("physical session requires lumina-bench-run.exe (FIXED_AFFINITY)");

const threadBudget = machine.threadBudget;
const warmup = 1;
const runsRequested = 5;
const cachePolicy = "hot-after-single-warmup";
const corpora = ["tiny", "silesia", "incompressible-64m", "dup-names"];
const extractors = ["7zip", "bandizip", "nanazip"];

const seven = await resolveTool("7zip", { physical: true });
const bandi = await resolveTool("bandizip", { physical: true });
seven.detectedVersion = (await detectInstalledVersion(seven)).detected;
bandi.detectedVersion = (await detectInstalledVersion(bandi)).detected;
await assertPhysicalTools(seven, bandi);

const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
const harnessCommit = (git.stdout || "").trim();
const sessionId = `g1-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const sessionDir = join(BENCH, "results", sessionId);
await mkdir(sessionDir, { recursive: true });
const outRoot = join(BENCH, "out", sessionId);

const session = {
  id: sessionId,
  authority,
  started: new Date().toISOString(),
  harnessCommit,
  threadBudget,
  warmup,
  runsRequested,
  cachePolicy,
  compressionThreadPolicy: "native-fixed-switch",
  extractionThreadPolicy: EXTRACTION_THREAD_POLICY_AFFINITY,
  helper,
  corpora,
  machine: { ...machine },
};
await writeJson(join(sessionDir, "session.json"), session);

const all = [];
const producers = [seven, bandi];
for (let ci = 0; ci < corpora.length; ci++) {
  const corpusId = corpora[ci];
  const corpusDir = await prepareCorpus(corpusId, outRoot);
  const sourceManifest = await treeManifest(corpusDir);
  const rotatedExtractors = rotateTools(extractors, ci);

  for (const producer of producers) {
    for (const format of ["zip", "7z"]) {
      const destArchive = join(outRoot, "fixtures", corpusId, `${format}-by-${producer.id}.${format === "7z" ? "7z" : "zip"}`);
      const fixture = await createCanonicalFixture({
        producer,
        format,
        corpusId,
        corpusDir,
        destArchive,
        threadBudget,
        helper,
      });
      await writeJson(join(sessionDir, `fixture-${corpusId}-${format}-${producer.id}.json`), fixture);

      const createRec = await measureCreate({
        authority, machine, threadBudget, warmup, runsRequested, tool: producer, corpusId, corpusDir, format, workRoot: outRoot, sourceManifest, cachePolicy, helper,
      });
      all.push(createRec);
      await writeJson(join(sessionDir, `${producer.id}-${corpusId}-${format}-create.json`), createRec);

      for (const extId of rotatedExtractors) {
        const extractor = await resolveTool(extId, { physical: extId === "bandizip" });
        if (extId === "nanazip" && !extractor.path) {
          all.push({
            schema: "lumina.bench.v1",
            authority,
            tool: { id: "nanazip", version: "6.5.1800" },
            corpus: { id: corpusId },
            op: `${format}-extract`,
            skipped: true,
            skipReason: "NanaZip optional — absence does not fail G1",
            archiveSha256: fixture.archiveSha256,
          });
          continue;
        }
        const rec = await measureExtract({
          authority, machine, threadBudget, warmup, runsRequested, tool: extractor, corpusId, fixture, workRoot: outRoot, sourceManifest, cachePolicy, helper,
        });
        all.push(rec);
        await writeJson(join(sessionDir, `${extId}-extracts-${format}-by-${producer.id}-${corpusId}.json`), rec);
      }
    }
  }

  const lumina = await resolveTool("lumina");
  all.push(await measureCreate({
    authority, machine, threadBudget, warmup, runsRequested, tool: lumina, corpusId, corpusDir, format: "zip", workRoot: outRoot, sourceManifest, cachePolicy, helper,
  }));
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
  extractionThreadPolicy: EXTRACTION_THREAD_POLICY_AFFINITY,
  schema: "lumina.bench.v1",
  silesia: (await readJson(join(ROOT, "eng/corpus-pins.json"))).silesiaZip.sha256,
  tools: { sevenZip: seven.detectedVersion, bandizip: bandi.detectedVersion },
};
const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintSrc)).digest("hex");
await writeJson(join(sessionDir, "G1-BASELINE.json"), {
  baselineId: `G1-${sessionId}`,
  machineFingerprint: fingerprint,
  harnessCommit,
  sessionId,
  authority,
  silesiaSha256: fingerprintSrc.silesia,
});
console.log(sessionDir);
