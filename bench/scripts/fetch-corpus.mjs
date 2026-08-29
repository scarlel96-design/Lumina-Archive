#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { ROOT, BENCH, readJson, sha256File } from "./common.mjs";
import { resolveSevenZipConsole } from "./measure-resolve.mjs";

const pins = await readJson(join(ROOT, "eng/corpus-pins.json"));
const destDir = join(ROOT, "vendor/cache");
await mkdir(destDir, { recursive: true });
const dest = join(destDir, pins.silesiaZip.filename);

const res = await fetch(pins.silesiaZip.url, {
  headers: { "User-Agent": "LuminaArchive-G1-silesia/0.1" },
  redirect: "follow",
});
if (!res.ok) {
  console.error(`Silesia fetch HTTP ${res.status} from ${pins.silesiaZip.url}`);
  process.exit(2);
}
await pipeline(res.body, createWriteStream(dest));
const got = await sha256File(dest);
if (got !== pins.silesiaZip.sha256) {
  await unlink(dest).catch(() => {});
  console.error(`Silesia SHA-256 mismatch expected ${pins.silesiaZip.sha256} got ${got}`);
  process.exit(1);
}

const extract = join(BENCH, "out/corpus/silesia");
await mkdir(extract, { recursive: true });
const seven = await resolveSevenZipConsole();
if (!seven) {
  console.error("Silesia extract needs resolved 7z.exe / 7za.exe / 7zz from the harness resolver");
  process.exit(1);
}
const r = spawnSync(seven, ["x", "-y", `-o${extract}`, dest], { stdio: "inherit" });
if (r.status !== 0) {
  console.error(`extract silesia failed via ${seven}`);
  process.exit(1);
}
console.log(`OK silesia ${got} via ${seven} -> ${extract}`);
