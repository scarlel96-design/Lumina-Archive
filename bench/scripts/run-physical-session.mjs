#!/usr/bin/env node
/**
 * Authoritative G1 competitor baseline. Refuses GitHub Actions and non-Windows.
 * Phases: validate → canonical fixtures (untimed) → rotated create → extract.
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
import { measureCreate, measureExtract, rotateTools, rotateCreateProducers } from "./measure.mjs";
import { resolveTool } from "./measure-resolve.mjs";
import { createCanonicalFixture } from "./fixtures.mjs";
import { resolveBenchRunner } from "./telemetry.mjs";
import { assertPhysicalTools, detectInstalledVersion } from "./versions-detect.mjs";
import { EXTRACTION_THREAD_POLICY_AFFINITY, CACHE_POLICY, CACHE_POLICY_NOTE } from "./thread-policy.mjs";
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
const cachePolicy = CACHE_POLICY;
const corpora = ["tiny", "silesia", "incompressible-64m", "dup-names"];
const extractors = ["7zip", "bandizip", "nanazip"];
const formats = ["zip", "7z"];

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

const producers = [seven, bandi];
const createOrderByCorpus = {};
for (let ci = 0; ci < corpora.length; ci++) {
  createOrderByCorpus[corpora[ci]] = rotateCreateProducers(
    producers.map((p) => p.id),
    ci,
  );
}

const session = {
  id: sessionId,
  authority,
  started: new Date().toISOString(),
  harnessCommit,
  threadBudget,
  warmup,
  runsRequested,
  fixtureSetupRuns: "not a benchmark sample",
  explicitWarmupRuns: warmup,
  measuredRuns: runsRequested,
  cachePolicy,
  cachePolicyNote: CACHE_POLICY_NOTE,
  compressionThreadPolicy: "native-fixed-switch",
  extractionThreadPolicy: EXTRACTION_THREAD_POLICY_AFFINITY,
  helper,
  corpora,
  createOrderByCorpus,
  machine: { ...machine },
  phases: ["validate", "canonical-fixtures", "timed-create", "timed-extract"],
};
await writeJson(join(sessionDir, "session.json"), session);

const prepared = [];
for (const corpusId of corpora) {
  const corpusDir = await prepareCorpus(corpusId, outRoot);
  prepared.push({ corpusId, corpusDir, sourceManifest: await treeManifest(corpusDir) });
}

const fixtures = [];
const fixtureSetupOrder = [];
for (const { corpusId, corpusDir, sourceManifest } of prepared) {
  for (const producer of producers) {
    for (const format of formats) {
      const destArchive = join(outRoot, "fixtures", corpusId, `${format}-by-${producer.id}.${format === "7z" ? "7z" : "zip"}`);
      const fixture = await createCanonicalFixture({
        producer, format, corpusId, corpusDir, destArchive, threadBudget, helper,
      });
      fixture.sourceManifest = sourceManifest;
      fixtures.push(fixture);
      fixtureSetupOrder.push({ corpusId, format, producer: producer.id, archiveSha256: fixture.archiveSha256 });
      await writeJson(join(sessionDir, `fixture-${corpusId}-${format}-${producer.id}.json`), fixture);
    }
  }
}
session.fixtureSetupOrder = fixtureSetupOrder;
await writeJson(join(sessionDir, "session.json"), session);

const all = [];
const timedCreateOrder = [];
for (let ci = 0; ci < prepared.length; ci++) {
  const { corpusId, corpusDir, sourceManifest } = prepared[ci];
  const order = rotateCreateProducers(producers, ci);
  timedCreateOrder.push({ corpusId, producers: order.map((p) => p.id) });
  for (const producer of order) {
    for (const format of formats) {
      const createRec = await measureCreate({
        authority, machine, threadBudget, warmup, runsRequested, tool: producer, corpusId, corpusDir, format, workRoot: outRoot, sourceManifest, cachePolicy, helper,
      });
      all.push(createRec);
      await writeJson(join(sessionDir, `${producer.id}-${corpusId}-${format}-create.json`), createRec);
    }
  }
  const lumina = await resolveTool("lumina");
  all.push(await measureCreate({
    authority, machine, threadBudget, warmup, runsRequested, tool: lumina, corpusId, corpusDir, format: "zip", workRoot: outRoot, sourceManifest, cachePolicy, helper,
  }));
}

const timedExtractOrder = [];
for (let ci = 0; ci < prepared.length; ci++) {
  const { corpusId, sourceManifest } = prepared[ci];
  const rotatedExtractors = rotateTools(extractors, ci);
  timedExtractOrder.push({ corpusId, extractors: rotatedExtractors });
  const corpusFixtures = fixtures.filter((f) => f.corpus === corpusId);
  for (const fixture of corpusFixtures) {
    for (const extId of rotatedExtractors) {
      const extractor = await resolveTool(extId, { physical: extId === "bandizip" });
      if (extId === "nanazip" && !extractor.path) {
        all.push({
          schema: "lumina.bench.v1",
          authority,
          tool: { id: "nanazip", version: "6.5.1800" },
          corpus: { id: corpusId },
          op: `${fixture.format}-extract`,
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
      await writeJson(join(sessionDir, `${extId}-extracts-${fixture.format}-by-${fixture.producer}-${corpusId}.json`), rec);
    }
  }
}

session.timedCreateOrder = timedCreateOrder;
session.timedExtractOrder = timedExtractOrder;
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
