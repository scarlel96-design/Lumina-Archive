#!/usr/bin/env node
import { join } from "node:path";
import { readJson } from "./common.mjs";
import { ROOT } from "./common.mjs";

const versions = await readJson(join(ROOT, "eng/versions.json"));
const pins = await readJson(join(ROOT, "eng/vendor-pins.json"));

const pending = [];
for (const [key, dep] of Object.entries(versions.dependencies)) {
  if (!dep.sha256 || dep.sha256 === "PENDING_OFFICIAL_ARTIFACT") {
    pending.push(key);
    continue;
  }
  if (!/^[0-9a-f]{64}$/.test(dep.sha256)) {
    throw new Error(`${key} sha256 is not a 64-char hex digest`);
  }
  const art = pins.artifacts.find((a) => a.dep === key && a.sha256 === dep.sha256);
  if (!art) {
    throw new Error(`${key} sha256 is not present in eng/vendor-pins.json`);
  }
}

if (pending.length) {
  console.error("PENDING hashes:", pending.join(", "));
  process.exit(1);
}

if (JSON.stringify(pins).includes("Bandizip.exe") || JSON.stringify(pins).toLowerCase().includes("bandizip/")) {
  throw new Error("Bandizip must not appear as a vendored pin");
}

console.log(`verify-pins OK (${Object.keys(versions.dependencies).length} deps)`);
