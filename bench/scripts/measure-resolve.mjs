import { access, constants, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, delimiter } from "node:path";
import { ROOT } from "./common.mjs";

function exeName(p) {
  return String(p).replaceAll("\\", "/").split("/").pop();
}

export async function findCached(names) {
  const root = join(ROOT, "vendor/cache");
  const want = new Set(names);
  async function walk(dir, depth) {
    if (depth > 4) return null;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isFile() && want.has(e.name)) return p;
      if (e.isDirectory()) {
        const hit = await walk(p, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }
  return walk(root, 0);
}

async function which(names) {
  const dirs = (process.env.PATH || "").split(delimiter);
  for (const n of names) {
    for (const c of [n, ...dirs.map((d) => join(d, n))]) {
      try {
        await access(c, constants.F_OK);
        return c;
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

export async function resolveSevenZipConsole() {
  return (
    process.env.LUMINA_7ZIP ||
    (await findCached(["7zz", "7za.exe", "7z.exe", "7za", "7z", "7zz.exe"])) ||
    (await which(["7z.exe", "7za.exe", "7zz", "7z", "7za", "7zz.exe"]))
  );
}

export async function resolveTool(id, { physical = false } = {}) {
  if (id === "7zip") {
    const path = await resolveSevenZipConsole();
    return { id, version: "26.02", expectedVersion: "26.02", path, kind: "7zip" };
  }
  if (id === "nanazip") {
    const path = process.env.LUMINA_NANAZIP || (await which(["NanaZip.Core.exe", "NanaZip.exe"]));
    return { id, version: "6.5.1800", expectedVersion: "6.5.1800", path, kind: "nanazip" };
  }
  if (id === "bandizip") {
    const guesses = physical
      ? [
          process.env.LUMINA_BANDIZIP,
          "C:\\Program Files\\Bandizip\\bz.exe",
          join(homedir(), "AppData/Local/Bandizip/bz.exe"),
        ]
      : [
          process.env.LUMINA_BANDIZIP,
          "C:\\Program Files\\Bandizip\\bz.exe",
          "C:\\Program Files\\Bandizip\\Bandizip.exe",
          join(homedir(), "AppData/Local/Bandizip/bz.exe"),
        ];
    let path = null;
    for (const g of guesses.filter(Boolean)) {
      try {
        await access(g, constants.F_OK);
        path = g;
        break;
      } catch {
        /* skip */
      }
    }
    if (physical && path && !/^bz\.exe$/i.test(exeName(path))) {
      throw new Error("physical Bandizip baseline requires bz.exe");
    }
    return { id, version: "7.46", expectedVersion: "7.46", path, kind: "bandizip" };
  }
  if (id === "lumina") {
    return { id, version: "0.0.0-g1", expectedVersion: null, path: null, kind: "lumina" };
  }
  throw new Error(`unknown tool ${id}`);
}

export function rotateTools(tools, corpusIndex) {
  const k = corpusIndex % tools.length;
  return [...tools.slice(k), ...tools.slice(0, k)];
}
