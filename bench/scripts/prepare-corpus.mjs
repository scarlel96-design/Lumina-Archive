#!/usr/bin/env node
import { mkdir, writeFile, cp } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { BENCH } from "./common.mjs";

export async function prepareCorpus(id, outRoot) {
  const dir = join(outRoot, "corpus", id);
  await mkdir(dir, { recursive: true });
  if (id === "tiny") {
    await cp(join(BENCH, "fixtures/tiny"), dir, { recursive: true });
    return dir;
  }
  if (id === "incompressible-64m") {
    await writeFile(join(dir, "rand.bin"), randomBytes(64 * 1024 * 1024));
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
