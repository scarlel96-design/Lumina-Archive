#!/usr/bin/env node
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { BENCH, readJson } from "./common.mjs";

function fmtMs(ms) {
  if (ms == null) return "—";
  return (ms / 1000).toFixed(3);
}

export function statusNote(r) {
  if (r.skipped) return r.skipReason || "SKIPPED";
  const s = r.summary || {};
  const requested = r.runsRequested ?? 5;
  const validRuns = s.measuredValid ?? 0;
  if (s.incomplete === true || validRuns < requested) return "INCOMPLETE";
  if (s.hash_ok === false) return "INVALID_CORRECTNESS";
  if (s.noisy) return "NOISY";
  return "ok";
}

function rowsFor(results, op) {
  const lines = [];
  for (const r of results) {
    if (r.op !== op) continue;
    if (r.tool?.id === "lumina") continue;
    const s = r.summary || {};
    const requested = r.runsRequested ?? 5;
    const validRuns = r.skipped ? "—" : `${s.measuredValid ?? 0}/${requested}`;
    const note = statusNote(r);
    lines.push(
      `| ${r.tool.id} | ${r.tool.version} | ${r.corpus.id} | ${op} | ${fmtMs(s.median)} | ${fmtMs(s.p95)} | ${s.throughputMBps ?? "—"} | ${s.output_bytes ?? "—"} | ${validRuns} | ${note} |`,
    );
  }
  return lines;
}

export async function loadSessionResults(sessionDir) {
  const allPath = join(sessionDir, "all.json");
  try {
    await access(allPath);
    const doc = JSON.parse(await readFile(allPath, "utf8"));
    if (Array.isArray(doc.results)) return doc.results;
  } catch {
    /* all.json missing */
  }
  throw new Error("RESULTS.md must render from all.json only");
}

export async function renderResultsMd(sessionDir, session, { writeRepoCopy = true } = {}) {
  const results = await loadSessionResults(sessionDir);
  const header =
    "| tool | version | corpus | op | median_s | p95_s | MB/s | output_bytes | valid_runs | status |";
  const sep = "|---|---|---|---|---|---|---|---|---|---|";
  const body = `# Bench results

G1 **external competitive baseline**. Generated from raw JSON (\`all.json\` only).
Do not hand-edit numbers. Lumina is SKIPPED_NOT_LINKED and is **not** in these tables.
You must not claim “faster than Bandizip”. That sentence is not authorized by G1.

- Session: \`${session.id}\`
- Authority: \`${session.authority}\`
- Cache policy: \`${session.cachePolicy}\`
- Thread budget: \`${session.threadBudget}\`
- Harness commit: \`${session.harnessCommit || "unknown"}\`

## ZIP create

${header}
${sep}
${rowsFor(results, "zip-create").join("\n") || "| — | — | — | — | — | — | — | — | — | no rows |"}

## ZIP extract

${header}
${sep}
${rowsFor(results, "zip-extract").join("\n") || "| — | — | — | — | — | — | — | — | — | no rows |"}

## Optional 7z

${header}
${sep}
${[...rowsFor(results, "7z-create"), ...rowsFor(results, "7z-extract")].join("\n") || "| — | — | — | — | — | — | — | — | — | no rows |"}

## Lumina

SKIPPED_NOT_LINKED — expected in G1. No timings. Competitive Lumina-vs-Bandizip is G5.
`;
  if (/Lumina is faster|beats Bandizip|Lumina is slower/i.test(body)) {
    throw new Error("render attempted a competitive Lumina claim");
  }
  if (writeRepoCopy) await writeFile(join(BENCH, "RESULTS.md"), body);
  await writeFile(join(sessionDir, "RESULTS.md"), body);
  return join(BENCH, "RESULTS.md");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  const session = await readJson(join(dir, "session.json"));
  console.log(await renderResultsMd(dir, session));
}
