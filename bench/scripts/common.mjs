import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
export const BENCH = join(ROOT, "bench");

export function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export async function sha256File(path) {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

export function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function p95(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1);
  return s[Math.max(0, idx)];
}

export function assertAuthority(authority) {
  const allowed = [
    "physical-windows",
    "github-runner-not-authoritative",
    "dev-not-authoritative",
  ];
  if (!allowed.includes(authority)) {
    throw new Error(`invalid authority ${authority}`);
  }
}

export function forbidAuthoritativeGithub(authority, tools) {
  if (authority === "physical-windows") return;
  if (tools.includes("bandizip")) {
    throw new Error(
      "Bandizip-vs-Lumina numbers are forbidden on github-hosted/dev runs. Use a physical Windows host.",
    );
  }
}

export async function fileSize(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

export { join, mkdir };
