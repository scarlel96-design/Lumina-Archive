#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BENCH, readJson } from "./common.mjs";

function fmtMs(ms) {
  if (ms == null) return "—";
  return (ms / 1000).toFixed(3);
}

function rowsFor(results, op) {
  const lines = [];
  for (const r of results) {
    if (r.op !== op) continue;
    if (r.tool?.id === "lumina") continue;
    const s = r.summary || {};
    const skip = r.skipped ? r.skipReason : "";
    if (skip) {
      lines.push(`| ${r.tool.id} | ${r.tool.version} | ${r.corpus.id} | ${op} | — | — | — | — | ${skip} |`);
      continue;
    }
    const noisy = s.noisy ? "NOISY" : "ok";
    lines.push(
      `| ${r.tool.id} | ${r.tool.version} | ${r.corpus.id} | ${op} | ${fmtMs(s.median)} | ${fmtMs(s.p95)} | ${s.throughputMBps ?? "—"} | ${s.output_bytes ?? "—"} | ${noisy} |`,
    );
  }
  return lines;
}

export async function renderResultsMd(sessionDir, session) {
  const files = (await readdir(sessionDir)).filter((f) => f.endsWith(".json") && f !== "session.json");
  const results = [];
  for (const f of files) {
    const doc = JSON.parse(await readFile(join(sessionDir, f), "utf8"));
    if (Array.isArray(doc.results)) results.push(...doc.results);
    else results.push(doc);
  }
  const body = `# Bench results

G1 **external competitive baseline**. Generated from raw JSON.
Do not hand-edit numbers. Lumina is SKIPPED_NOT_LINKED and is **not** in these tables.
You must not claim “faster than Bandizip”. That sentence is not authorized by G1.

- Session: \`${session.id}\`
- Authority: \`${session.authority}\`
- Cache policy: \`${session.cachePolicy}\`
- Thread budget: \`${session.threadBudget}\`
- Harness commit: \`${session.harnessCommit || "unknown"}\`

## ZIP create

| tool | version | corpus | op | median_s | p95_s | MB/s | output_bytes | notes |
|---|---|---|---|---|---|---|---|---|
${rowsFor(results, "zip-create").join("\n") || "| — | — | — | — | — | — | — | — | no rows |"}

## ZIP extract

| tool | version | corpus | op | median_s | p95_s | MB/s | output_bytes | notes |
|---|---|---|---|---|---|---|---|---|
${rowsFor(results, "zip-extract").join("\n") || "| — | — | — | — | — | — | — | — | no rows |"}

## Optional 7z

| tool | version | corpus | op | median_s | p95_s | MB/s | output_bytes | notes |
|---|---|---|---|---|---|---|---|---|
${[...rowsFor(results, "7z-create"), ...rowsFor(results, "7z-extract")].join("\n") || "| — | — | — | — | — | — | — | — | no rows |"}

## Lumina

SKIPPED_NOT_LINKED — expected in G1. No timings. Competitive Lumina-vs-Bandizip is G5.
`;
  if (/Lumina is faster|beats Bandizip|Lumina is slower/i.test(body)) {
    throw new Error("render attempted a competitive Lumina claim");
  }
  await writeFile(join(BENCH, "RESULTS.md"), body);
  await writeFile(join(sessionDir, "RESULTS.md"), body);
  return join(BENCH, "RESULTS.md");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  const session = await readJson(join(dir, "session.json"));
  console.log(await renderResultsMd(dir, session));
}
