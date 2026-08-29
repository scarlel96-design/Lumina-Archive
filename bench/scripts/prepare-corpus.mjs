#!/usr/bin/env node
import { mkdir, writeFile, cp, access, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { BENCH, ROOT, readJson } from "./common.mjs";

export function deterministicBytes(byteCount, seed) {
  const out = Buffer.alloc(byteCount);
  let off = 0;
  let n = 0;
  while (off < byteCount) {
    const block = createHash("sha256").update(seed).update(Buffer.from(String(n))).digest();
    const take = Math.min(block.length, byteCount - off);
    block.copy(out, off, 0, take);
    off += take;
    n += 1;
  }
  return out;
}

export async function prepareCorpus(id, outRoot) {
  const dir = join(outRoot, "corpus", id);
  await mkdir(dir, { recursive: true });
  if (id === "tiny") {
    await cp(join(BENCH, "fixtures/tiny"), dir, { recursive: true });
    return dir;
  }
  if (id === "incompressible-64m") {
    const pins = await readJson(join(ROOT, "eng/corpus-pins.json"));
    const buf = deterministicBytes(pins.incompressible64m.bytes, pins.incompressible64m.seed);
    await writeFile(join(dir, pins.incompressible64m.filename), buf);
    return dir;
  }
  if (id === "silesia") {
    const zip = join(ROOT, "vendor/cache/silesia.zip");
    try {
      await access(zip);
    } catch {
      throw new Error("silesia.zip missing — run node bench/scripts/fetch-corpus.mjs");
    }
    const existing = await readdir(dir).catch(() => []);
    if (!existing.includes("dickens")) {
      const unzip = spawnSync("unzip", ["-o", "-q", zip, "-d", dir], { stdio: "inherit" });
      if (unzip.status !== 0) {
        const seven = spawnSync("7zz", ["x", "-y", `-o${dir}`, zip], { stdio: "inherit" });
        if (seven.status !== 0) throw new Error("cannot extract silesia");
      }
    }
    return dir;
  }
  if (id === "encoding-names") {
    await cp(join(BENCH, "fixtures/encoding"), dir, { recursive: true });
    return dir;
  }
  if (id === "hostile-paths") {
    await cp(join(BENCH, "fixtures/hostile"), dir, { recursive: true });
    return dir;
  }
  throw new Error(`corpus ${id} is physical-fetch only or unknown`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] || "tiny";
  const dir = await prepareCorpus(id, join(BENCH, "out"));
  console.log(dir);
}
