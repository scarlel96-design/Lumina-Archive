#!/usr/bin/env node
import { mkdir, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT } from "./common.mjs";

const cache = join(ROOT, "vendor/cache");
await mkdir(cache, { recursive: true });

if (process.platform === "win32") {
  const sevenZr = join(cache, "7zr.exe");
  const extra = join(cache, "7z2602-extra.7z");
  const dest = join(cache, "7zip-extra");
  await mkdir(dest, { recursive: true });
  const r = spawnSync(sevenZr, ["x", "-y", `-o${dest}`, extra], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  const tarball = join(cache, "7z2602-linux-x64.tar.xz");
  const dest = join(cache, "7zip-linux");
  await mkdir(dest, { recursive: true });
  const r = spawnSync("tar", ["-xJf", tarball, "-C", dest], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  try {
    await chmod(join(dest, "7zz"), 0o755);
  } catch {
    /* already executable */
  }
}
