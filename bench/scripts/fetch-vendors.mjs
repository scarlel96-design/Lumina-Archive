#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { ROOT, sha256File, readJson } from "./common.mjs";

const pins = await readJson(join(ROOT, "eng/vendor-pins.json"));
const destRoot = join(ROOT, "vendor/cache");
await mkdir(destRoot, { recursive: true });

const only = process.argv.filter((a) => a.startsWith("--id=")).map((a) => a.slice(5));
const targets = only.length
  ? pins.artifacts.filter((a) => only.includes(a.id) || only.includes(a.dep))
  : pins.artifacts;

let failed = 0;
for (const art of targets) {
  const dest = join(destRoot, art.artifact);
  process.stderr.write(`fetch ${art.artifact}\n`);
  try {
    const res = await fetch(art.url, {
      headers: { "User-Agent": "LuminaArchive-G1-pin/0.1" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await pipeline(res.body, createWriteStream(dest));
    const got = await sha256File(dest);
    if (got !== art.sha256) {
      await unlink(dest).catch(() => {});
      throw new Error(`SHA-256 mismatch expected ${art.sha256} got ${got}`);
    }
    process.stdout.write(`OK ${art.id} ${got}\n`);
  } catch (err) {
    failed += 1;
    process.stderr.write(`FAIL ${art.id}: ${err.message}\n`);
  }
}

if (failed) process.exit(1);
