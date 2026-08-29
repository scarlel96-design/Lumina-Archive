/**
 * G1 output parsers. Wall time is measured by the harness, not these banners.
 * No password flags are recognized as valid production argv.
 */

export function rejectSecretArgv(argv) {
  const joined = argv.join(" ");
  if (/(?:^|\s)-p\S+/.test(joined) || /password=/i.test(joined)) {
    throw new Error("bench argv must not carry passwords");
  }
}

export function parse7zip(stdout, stderr = "") {
  const text = `${stdout}\n${stderr}`;
  const version = text.match(/7-Zip(?: \(z\))? ([0-9.]+)/)?.[1] ?? null;
  const archiveSize = parseInt(text.match(/Archive size:\s+(\d+)/)?.[1] ?? "", 10);
  const files = parseInt(text.match(/Files:\s+(\d+)/)?.[1] ?? "", 10);
  const ok = /Everything is Ok/i.test(text);
  return {
    family: "7zip",
    version,
    archive_bytes: Number.isFinite(archiveSize) ? archiveSize : null,
    files: Number.isFinite(files) ? files : null,
    ok,
  };
}

export function parseNanaZip(stdout, stderr = "") {
  const parsed = parse7zip(stdout, stderr);
  parsed.family = "nanazip";
  const nana = `${stdout}\n${stderr}`.match(/NanaZip(?:\.Core)? ([0-9.]+)/i)?.[1];
  if (nana) parsed.version = nana;
  return parsed;
}

export function parseBandizip(stdout, stderr = "", exitCode = 0) {
  const text = `${stdout}\n${stderr}`;
  const version = text.match(/Bandizip(?:\.com)?\s+([0-9.]+)/i)?.[1] ?? null;
  return {
    family: "bandizip",
    version,
    archive_bytes: null,
    files: null,
    ok: exitCode === 0 && !/error/i.test(text),
  };
}

export function parseLumina(stdout, stderr = "", exitCode = 0) {
  const text = `${stdout}\n${stderr}`;
  const identity = (() => {
    try {
      return JSON.parse(text.trim().split("\n").at(-1));
    } catch {
      return null;
    }
  })();
  const notLinked =
    exitCode === 2 ||
    /not implemented/i.test(text) ||
    identity?.engine === "not-linked";
  return {
    family: "lumina",
    version: identity?.version ?? null,
    engine: identity?.engine ?? (notLinked ? "not-linked" : null),
    ok: exitCode === 0 && !notLinked,
    skipped: notLinked,
    skipReason: notLinked ? "G1: lumina-engine codecs are not linked" : undefined,
  };
}
