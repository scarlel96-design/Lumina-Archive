export const PINNED_SILESIA = "0626e25f45c0ffb5dc801f13b7c82a3b75743ba07e3a71835a41e3d9f63c77af";
export const REQUIRED_SEVENZIP = "26.02";
export const REQUIRED_BANDIZIP = "7.46";
export const MANDATORY_TOOLS = ["7zip", "bandizip"];
export const MANDATORY_CORPORA = ["tiny", "silesia", "incompressible-64m", "dup-names"];
export const MANDATORY_FORMATS = ["zip", "7z"];
export const EXPECTED_MANDATORY_COUNT = 48;

export function expectedMandatoryKeys() {
  const keys = [];
  for (const tool of MANDATORY_TOOLS) {
    for (const corpus of MANDATORY_CORPORA) {
      for (const format of MANDATORY_FORMATS) {
        keys.push(`create:${tool}:${corpus}:${format}`);
      }
    }
  }
  for (const extractor of MANDATORY_TOOLS) {
    for (const corpus of MANDATORY_CORPORA) {
      for (const format of MANDATORY_FORMATS) {
        for (const producer of MANDATORY_TOOLS) {
          keys.push(`extract:${extractor}:${corpus}:${format}:${producer}`);
        }
      }
    }
  }
  return keys;
}

export function isMandatoryResult(r) {
  if (!r) return false;
  if (r.tool?.id === "lumina") return false;
  if (r.tool?.id === "nanazip") return false;
  if (r.skipped && /NanaZip/i.test(r.skipReason || "")) return false;
  return ["zip-create", "zip-extract", "7z-create", "7z-extract"].includes(r.op);
}

export function configKey(r) {
  if (!r?.op || !r.tool?.id || !r.corpus?.id) return null;
  const format = r.op.startsWith("7z") ? "7z" : r.op.startsWith("zip") ? "zip" : null;
  if (!format) return null;
  if (r.op.endsWith("-create")) return `create:${r.tool.id}:${r.corpus.id}:${format}`;
  if (r.op.endsWith("-extract")) {
    const producer = r.fixture?.producer;
    if (!producer) return null;
    return `extract:${r.tool.id}:${r.corpus.id}:${format}:${producer}`;
  }
  return null;
}

function exeName(p) {
  return String(p || "").replaceAll("\\", "/").split("/").pop();
}

function label(r) {
  return configKey(r) || `${r.tool?.id || "?"} ${r.corpus?.id || "?"} ${r.op || "?"}`;
}

function checkLumina(list, reasons) {
  const lumina = list.filter((r) => r.tool?.id === "lumina");
  if (lumina.length === 0) reasons.push("Lumina SKIPPED_NOT_LINKED records missing");
  for (const r of lumina) {
    if (r.skipped !== true || r.skipReason !== "SKIPPED_NOT_LINKED") {
      reasons.push("Lumina must be skipped=true skipReason=SKIPPED_NOT_LINKED");
    }
    if (r.summary?.n > 0 || (r.runs || []).some((x) => x.wall_ms != null && x.valid === true)) {
      reasons.push("Lumina timing records are forbidden in G1");
    }
  }
}

function checkSession(session, silesiaSha256, reasons) {
  if (session?.authority !== "physical-windows") reasons.push("authority != physical-windows");
  if ((silesiaSha256 || session?.silesiaSha256) !== PINNED_SILESIA) reasons.push("Silesia SHA-256 mismatch");
  if (session?.warmup !== 1) reasons.push("session.warmup != 1");
  if (session?.explicitWarmupRuns !== 1) reasons.push("session.explicitWarmupRuns != 1");
  if (session?.measuredRuns !== 5) reasons.push("session.measuredRuns != 5");
}

function checkTool(r, reasons) {
  if (r.tool.id === "7zip" && r.tool.version !== REQUIRED_SEVENZIP) {
    reasons.push(`${label(r)} 7-Zip version ${r.tool.version} != ${REQUIRED_SEVENZIP}`);
  }
  if (r.tool.id === "bandizip") {
    if (r.tool.version !== REQUIRED_BANDIZIP) {
      reasons.push(`${label(r)} Bandizip version ${r.tool.version} != ${REQUIRED_BANDIZIP}`);
    }
    if (!/^bz\.exe$/i.test(exeName(r.tool.path))) {
      reasons.push(`${label(r)} Bandizip path is not bz.exe`);
    }
  }
}

function checkMeasuredRuns(r, reasons) {
  const measured = (r.runs || []).filter((x) => !x.warmup);
  if (r.runsRequested !== 5) reasons.push(`${label(r)} runsRequested != 5`);
  if (r.summary?.measuredValid !== 5) reasons.push(`${label(r)} measuredValid != 5`);
  if (r.summary?.n !== 5) reasons.push(`${label(r)} summary.n != 5`);
  if (r.summary?.incomplete !== false) reasons.push(`${label(r)} incomplete`);
  if (r.summary?.hash_ok !== true) reasons.push(`${label(r)} correctness failed`);
  if (measured.length !== 5) reasons.push(`${label(r)} measured run objects != 5`);
  const create = r.op.endsWith("-create");
  for (const [i, x] of measured.entries()) {
    if (x.valid !== true) reasons.push(`${label(r)} measured[${i}] valid != true`);
    if (x.launcher_ok !== true) reasons.push(`${label(r)} measured[${i}] launcher_ok != true`);
    if (x.helperFailed !== false) reasons.push(`${label(r)} measured[${i}] helperFailed`);
    if (x.exitCode !== 0) reasons.push(`${label(r)} measured[${i}] exitCode != 0`);
    if (x.telemetry?.launcher_ok !== true) reasons.push(`${label(r)} measured[${i}] telemetry.launcher_ok != true`);
    if (x.telemetry?.affinity_applied !== true) reasons.push(`${label(r)} measured[${i}] telemetry.affinity_applied != true`);
    if (create) {
      const v = x.verification;
      if (!v || v.attempted !== true) reasons.push(`${label(r)} measured[${i}] verification not attempted`);
      else {
        if (v.launcher_ok !== true) reasons.push(`${label(r)} measured[${i}] verification.launcher_ok != true`);
        if (v.helperFailed !== false) reasons.push(`${label(r)} measured[${i}] verification.helperFailed`);
        if (v.exitCode !== 0) reasons.push(`${label(r)} measured[${i}] verification.exitCode != 0`);
        if (v.affinity_applied !== true) reasons.push(`${label(r)} measured[${i}] verification.affinity_applied != true`);
        if (v.hash_ok !== true) reasons.push(`${label(r)} measured[${i}] verification.hash_ok != true`);
      }
      if (x.hash_ok !== true) reasons.push(`${label(r)} measured[${i}] hash_ok != true`);
    }
  }
}

function checkExtractIdentity(mandatory, reasons) {
  const groups = new Map();
  for (const r of mandatory) {
    if (!r.op.endsWith("-extract")) continue;
    if (!r.archiveSha256 || !r.fixture?.archiveSha256) {
      reasons.push(`${label(r)} missing archiveSha256/fixture`);
      continue;
    }
    if (r.archiveSha256 !== r.fixture.archiveSha256) {
      reasons.push(`${label(r)} archiveSha256 != fixture.archiveSha256`);
    }
    const g = `${r.corpus.id}:${r.op.startsWith("7z") ? "7z" : "zip"}:${r.fixture.producer}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  for (const [g, recs] of groups) {
    const shas = new Set(recs.map((r) => r.archiveSha256));
    if (shas.size > 1) reasons.push(`canonical extract SHA mismatch for ${g}`);
  }
}

function checkMatrix(mandatory, reasons) {
  const expected = expectedMandatoryKeys();
  const expectedSet = new Set(expected);
  const observed = [];
  const counts = new Map();
  for (const r of mandatory) {
    const key = configKey(r);
    if (!key || !expectedSet.has(key)) {
      reasons.push(`unexpected mandatory key ${key || label(r)}`);
      continue;
    }
    observed.push(key);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const key of expected) {
    const n = counts.get(key) || 0;
    if (n === 0) reasons.push(`missing mandatory key ${key}`);
    if (n > 1) reasons.push(`duplicate mandatory key ${key}`);
  }
  if (expected.length !== EXPECTED_MANDATORY_COUNT) {
    reasons.push(`internal expected key count ${expected.length} != ${EXPECTED_MANDATORY_COUNT}`);
  }
}

export function validatePhysicalSession({ session, results, silesiaSha256 }) {
  const reasons = [];
  const list = Array.isArray(results) ? results : [];
  checkSession(session, silesiaSha256, reasons);
  checkLumina(list, reasons);
  const mandatory = list.filter(isMandatoryResult);
  if (mandatory.length === 0) reasons.push("no mandatory results");
  checkMatrix(mandatory, reasons);
  for (const r of mandatory) {
    checkTool(r, reasons);
    checkMeasuredRuns(r, reasons);
  }
  checkExtractIdentity(mandatory, reasons);
  return { accepted: reasons.length === 0, reasons };
}
