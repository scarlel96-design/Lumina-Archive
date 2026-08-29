import { spawn } from "node:child_process";

export const REQUIRED = {
  sevenZip: "26.02",
  bandizip: "7.46",
  nanaZip: "6.5.1800",
};

export function parseSevenZipVersion(text) {
  return text.match(/7-Zip(?: \(z\))? ([0-9.]+)/)?.[1] ?? null;
}

export function parseBandizipBanner(text) {
  const rawAll = String(text ?? "");
  for (const line of rawAll.split(/\r?\n/)) {
    const m = line.match(/^\s*(bz|bandizip(?:\.com)?)\s+v?(\d+(?:\.\d+)*)(.*)$/i);
    if (!m) continue;
    const rest = m[3] || "";
    const paren = rest.match(/^\(([^)]*)\)/);
    let versionQualifier = null;
    let architectureQualifier = null;
    if (paren) {
      for (const p of paren[1].split(",").map((s) => s.trim()).filter(Boolean)) {
        if (/^beta$/i.test(p)) versionQualifier = "Beta";
        else if (/^(x64|x86|arm64)$/i.test(p)) architectureQualifier = p;
      }
    }
    return {
      detected: m[2],
      versionQualifier,
      architectureQualifier,
      raw: line.trim(),
    };
  }
  return { detected: null, versionQualifier: null, architectureQualifier: null, raw: rawAll.slice(0, 240) };
}

export function parseBandizipVersion(text) {
  return parseBandizipBanner(text).detected;
}

export function parseNanaZipVersion(text) {
  return text.match(/NanaZip(?:\.Core)? ([0-9.]+)/i)?.[1] ?? null;
}

function runBanner(command, argv) {
  return new Promise((resolve) => {
    const child = spawn(command, argv, { windowsHide: true });
    let text = "";
    child.stdout?.on("data", (d) => {
      text += d.toString();
    });
    child.stderr?.on("data", (d) => {
      text += d.toString();
    });
    child.on("error", () => resolve(text));
    child.on("close", () => resolve(text));
  });
}

export async function detectInstalledVersion(tool) {
  if (!tool?.path) return { detected: null, text: "", versionQualifier: null, architectureQualifier: null };
  const text = await runBanner(tool.path, []);
  if (tool.kind === "7zip") {
    return { detected: parseSevenZipVersion(text), text, versionQualifier: null, architectureQualifier: null };
  }
  if (tool.kind === "bandizip") {
    const parsed = parseBandizipBanner(text);
    return { ...parsed, text };
  }
  if (tool.kind === "nanazip") {
    return { detected: parseNanaZipVersion(text), text, versionQualifier: null, architectureQualifier: null };
  }
  return { detected: null, text };
}

function exeName(p) {
  return String(p).replaceAll("\\", "/").split("/").pop();
}

export function assertPhysicalBandizipPath(path) {
  if (!path || !/^bz\.exe$/i.test(exeName(path))) {
    throw new Error("physical Bandizip baseline requires bz.exe (not Bandizip.exe GUI)");
  }
}

export function assertExactVersion(detected, expected, name, detail) {
  if (detected !== expected) {
    const extra = detail ? `; ${detail}` : "";
    throw new Error(`${name} installed version ${detected ?? "unknown"} != required ${expected}${extra}`);
  }
}

export async function assertPhysicalTools(seven, bandi) {
  assertPhysicalBandizipPath(bandi.path);
  const b = await detectInstalledVersion(bandi);
  const bannerLine = (b.raw || b.text || "").split(/\r?\n/)[0] || "";
  assertExactVersion(
    b.detected,
    REQUIRED.bandizip,
    "Bandizip",
    `path=${bandi.path}; parser=${b.detected === null ? "null" : b.detected}; banner=${JSON.stringify(bannerLine)}`,
  );
  const s = await detectInstalledVersion(seven);
  assertExactVersion(
    s.detected,
    REQUIRED.sevenZip,
    "7-Zip",
    `path=${seven.path}; parser=${s.detected === null ? "null" : s.detected}; banner=${JSON.stringify((s.text || "").split(/\r?\n/)[0] || "")}`,
  );
  return { seven: s, bandizip: b };
}
