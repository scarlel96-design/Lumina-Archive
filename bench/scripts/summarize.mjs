#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BENCH, readJson } from "./common.mjs";

const input = process.argv[2] || join(BENCH, "out/latest.json");
const doc = await readJson(input);

if (doc.authority === "physical-windows") {
  console.log("authority=physical-windows (eligible for RESULTS.md after review)");
} else {
  console.log(`authority=${doc.authority} — DO NOT copy these numbers into marketing or Bandizip comparisons.`);
}

for (const r of doc.results) {
  const s = r.summary || {};
  const skip = r.skipped ? ` SKIP ${r.skipReason}` : "";
  console.log(
    `${r.tool.id} ${r.op} ${r.corpus.id} median_ms=${s.median_ms ?? "n/a"} p95_ms=${s.p95_ms ?? "n/a"}${skip}`,
  );
}

if (doc.authority !== "physical-windows") {
  const claims = await readFile(join(BENCH, "RESULTS.md"), "utf8");
  if (/faster than Bandizip/i.test(claims) && !/must not claim/i.test(claims)) {
    throw new Error("RESULTS.md must not claim faster-than-Bandizip without the marketing gate");
  }
}
