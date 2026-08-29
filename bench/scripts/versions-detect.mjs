import { spawn } from "node:child_process";

export const REQUIRED = {
  sevenZip: "26.02",
  bandizip: "7.46",
  nanaZip: "6.5.1800",
};

export function parseSevenZipVersion(text) {
  return text.match(/7-Zip(?: \(z\))? ([0-9.]+)/)?.[1] ?? null;
}

export function parseBandizipVersion(text) {
  return text.match(/Bandizip(?:\.com)?\s+v?([0-9.]+)/i)?.[1] ?? null;
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
  if (!tool?.path) return { detected: null, text: "" };
  const text = await runBanner(tool.path, []);
  let detected = null;
  if (tool.kind === "7zip") detected = parseSevenZipVersion(text);
  else if (tool.kind === "bandizip") detected = parseBandizipVersion(text);
  else if (tool.kind === "nanazip") detected = parseNanaZipVersion(text);
  return { detected, text };
}

function exeName(p) {
  return String(p).replaceAll("\\", "/").split("/").pop();
}

export function assertPhysicalBandizipPath(path) {
  if (!path || !/^bz\.exe$/i.test(exeName(path))) {
    throw new Error("physical Bandizip baseline requires bz.exe (not Bandizip.exe GUI)");
  }
}

export function assertExactVersion(detected, expected, name) {
  if (detected !== expected) {
    throw new Error(`${name} installed version ${detected ?? "unknown"} != required ${expected}`);
  }
}

export async function assertPhysicalTools(seven, bandi) {
  assertExactVersion((await detectInstalledVersion(seven)).detected, REQUIRED.sevenZip, "7-Zip");
  assertPhysicalBandizipPath(bandi.path);
  assertExactVersion((await detectInstalledVersion(bandi)).detected, REQUIRED.bandizip, "Bandizip");
}
