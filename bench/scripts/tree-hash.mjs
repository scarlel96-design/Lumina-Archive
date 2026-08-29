import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createReadStream } from "node:fs";

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function walk(dir, root, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, root, out);
    else if (e.isFile()) {
      const st = await stat(p);
      const rel = p.slice(root.length + 1).replaceAll("\\", "/");
      out.push({ path: rel, bytes: st.size, sha256: await sha256File(p) });
    }
  }
}

export async function treeManifest(dir) {
  const files = [];
  await walk(dir, dir, files);
  files.sort((a, b) => a.path.localeCompare(b.path));
  const h = createHash("sha256");
  for (const f of files) h.update(`${f.path}\t${f.bytes}\t${f.sha256}\n`);
  return { files, treeSha256: h.digest("hex") };
}

export function manifestsEqual(a, b) {
  if (a.treeSha256 === b.treeSha256) return true;
  if (a.files.length !== b.files.length) return false;
  const byName = (list) => {
    const m = new Map();
    for (const f of list) m.set(f.path.split("/").pop(), f);
    return m;
  };
  const am = byName(a.files);
  const bm = byName(b.files);
  if (am.size !== bm.size) return false;
  for (const [name, f] of am) {
    const g = bm.get(name);
    if (!g || g.bytes !== f.bytes || g.sha256 !== f.sha256) return false;
  }
  return true;
}
