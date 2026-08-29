import { mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { sha256File, fileSize, writeJson } from "./common.mjs";
import { listRelativeFiles, treeManifest } from "./tree-hash.mjs";
import { spawnTimed } from "./telemetry.mjs";
import { affinityMask } from "./thread-policy.mjs";

export function createArgs(tool, archive, files, threadBudget, format) {
  const mmt = String(threadBudget);
  if (tool.kind === "7zip" || tool.kind === "nanazip") {
    const t = format === "7z" ? ["-t7z", "-mx=5"] : ["-tzip", "-mx=1"];
    return ["a", ...t, `-mmt=${mmt}`, "-y", archive, ...files];
  }
  if (tool.kind === "bandizip") {
    const fmt = format === "7z" ? "7z" : "zip";
    const level = format === "7z" ? "5" : "1";
    return ["c", `-l:${level}`, "-aoa", `-t:${mmt}`, `-fmt:${fmt}`, "-y", archive, ...files];
  }
  throw new Error(`no create argv for ${tool.id}`);
}

export function extractArgs(tool, archive, destDir) {
  if (tool.kind === "7zip" || tool.kind === "nanazip") {
    return ["x", "-y", archive, `-o${destDir}`];
  }
  if (tool.kind === "bandizip") {
    return ["x", "-aoa", "-y", `-o:${destDir}`, archive];
  }
  throw new Error(`no extract argv for ${tool.id}`);
}

export function extractDestPath(workRoot, fixtureId, extractorId, runIndex) {
  return join(workRoot, "extract", fixtureId, extractorId, `run-${runIndex}`);
}

export async function ensureCleanDir(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

export async function createCanonicalFixture({
  producer,
  format,
  corpusId,
  corpusDir,
  destArchive,
  threadBudget,
  helper,
}) {
  const files = await listRelativeFiles(corpusDir);
  const argv = createArgs(producer, destArchive, files, threadBudget, format);
  await mkdir(dirname(destArchive), { recursive: true });
  await rm(destArchive, { force: true });
  const run = await spawnTimed(producer.path, argv, corpusDir, {
    helper,
    affinityMask: affinityMask(threadBudget),
  });
  if (run.exitCode !== 0) {
    throw new Error(`fixture create failed ${producer.id} ${format}: ${run.stderr}`);
  }
  const source = await treeManifest(corpusDir);
  const meta = {
    corpus: corpusId,
    format,
    producer: producer.id,
    producerVersion: producer.detectedVersion || producer.version,
    argv,
    cwd: corpusDir,
    sourceManifestSha256: source.treeSha256,
    archiveSha256: await sha256File(destArchive),
    archiveBytes: await fileSize(destArchive),
    creationTimestamp: new Date().toISOString(),
    archive: destArchive,
  };
  await writeJson(destArchive + ".meta.json", meta);
  return meta;
}
