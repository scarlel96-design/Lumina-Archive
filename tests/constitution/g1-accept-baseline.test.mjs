import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  validatePhysicalSession,
  PINNED_SILESIA,
  expectedMandatoryKeys,
  EXPECTED_MANDATORY_COUNT,
  configKey,
} from "../../bench/scripts/accept-baseline.mjs";

const CORPORA = ["tiny", "silesia", "incompressible-64m", "dup-names"];
const TOOLS = ["7zip", "bandizip"];
const FORMATS = ["zip", "7z"];

function goodRun(create) {
  const row = {
    warmup: false,
    valid: true,
    hash_ok: true,
    launcher_ok: true,
    helperFailed: false,
    exitCode: 0,
    telemetry: { launcher_ok: true, affinity_applied: true },
  };
  if (create) {
    row.verification = {
      attempted: true,
      launcher_ok: true,
      helperFailed: false,
      exitCode: 0,
      affinity_applied: true,
      hash_ok: true,
    };
  }
  return row;
}

function toolMeta(id) {
  if (id === "7zip") return { id, version: "26.02", path: "C:\\\\cache\\\\7z.exe" };
  return { id, version: "7.46", path: "C:\\\\Program Files\\\\Bandizip\\\\bz.exe" };
}

function sha(seed) {
  return Buffer.from(seed).toString("hex").padEnd(64, "0").slice(0, 64);
}

function completeMatrix() {
  const session = {
    authority: "physical-windows",
    warmup: 1,
    explicitWarmupRuns: 1,
    measuredRuns: 5,
    silesiaSha256: PINNED_SILESIA,
  };
  const results = [];
  for (const tool of TOOLS) {
    for (const corpus of CORPORA) {
      for (const format of FORMATS) {
        const op = `${format}-create`;
        results.push({
          tool: toolMeta(tool),
          corpus: { id: corpus },
          op,
          skipped: false,
          runsRequested: 5,
          runs: [{ warmup: true, valid: true, telemetry: { launcher_ok: true, affinity_applied: true } }, ...Array.from({ length: 5 }, () => goodRun(true))],
          summary: { n: 5, measuredValid: 5, incomplete: false, hash_ok: true },
        });
      }
    }
  }
  for (const extractor of TOOLS) {
    for (const corpus of CORPORA) {
      for (const format of FORMATS) {
        for (const producer of TOOLS) {
          const archiveSha256 = sha(`${corpus}:${format}:${producer}`);
          results.push({
            tool: toolMeta(extractor),
            corpus: { id: corpus },
            op: `${format}-extract`,
            skipped: false,
            runsRequested: 5,
            archiveSha256,
            fixture: { producer, format, archiveSha256 },
            runs: [{ warmup: true, valid: true, telemetry: { launcher_ok: true, affinity_applied: true } }, ...Array.from({ length: 5 }, () => goodRun(false))],
            summary: { n: 5, measuredValid: 5, incomplete: false, hash_ok: true },
          });
        }
      }
    }
  }
  for (const corpus of CORPORA) {
    results.push({
      tool: { id: "lumina", version: "0.0.0-g1", path: "" },
      corpus: { id: corpus },
      op: "zip-create",
      skipped: true,
      skipReason: "SKIPPED_NOT_LINKED",
    });
  }
  return { session, results };
}

test("expected mandatory matrix is exactly 48 unique keys", () => {
  const keys = expectedMandatoryKeys();
  assert.equal(keys.length, EXPECTED_MANDATORY_COUNT);
  assert.equal(new Set(keys).size, 48);
  const { results } = completeMatrix();
  const observed = results.filter((r) => r.tool.id !== "lumina").map(configKey);
  assert.deepEqual([...observed].sort(), [...keys].sort());
});

test("full exact 48-key matrix is accepted", () => {
  const { session, results } = completeMatrix();
  const v = validatePhysicalSession({ session, results, silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, true, v.reasons.join("\n"));
});

test("missing one create key is rejected", () => {
  const { session, results } = completeMatrix();
  const next = results.filter((r) => configKey(r) !== "create:7zip:tiny:zip");
  const v = validatePhysicalSession({ session, results: next, silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
  assert.ok(v.reasons.some((x) => x.includes("missing mandatory key create:7zip:tiny:zip")));
});

test("missing one extraction key is rejected", () => {
  const { session, results } = completeMatrix();
  const next = results.filter((r) => configKey(r) !== "extract:bandizip:silesia:zip:7zip");
  const v = validatePhysicalSession({ session, results: next, silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
  assert.ok(v.reasons.some((x) => x.includes("missing mandatory key extract:bandizip:silesia:zip:7zip")));
});

test("duplicate one record while another is missing is rejected", () => {
  const { session, results } = completeMatrix();
  const dup = results.find((r) => configKey(r) === "create:7zip:tiny:zip");
  const next = results.filter((r) => configKey(r) !== "create:bandizip:tiny:zip");
  next.push(structuredClone(dup));
  const v = validatePhysicalSession({ session, results: next, silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
  assert.ok(v.reasons.some((x) => x.includes("duplicate mandatory key create:7zip:tiny:zip")));
  assert.ok(v.reasons.some((x) => x.includes("missing mandatory key create:bandizip:tiny:zip")));
});

test("48 records with one duplicate and one missing is rejected", () => {
  const { session, results } = completeMatrix();
  const mandatory = results.filter((r) => r.tool.id !== "lumina");
  const lumina = results.filter((r) => r.tool.id === "lumina");
  const dup = mandatory.find((r) => configKey(r) === "create:7zip:tiny:7z");
  const next = mandatory.filter((r) => configKey(r) !== "create:bandizip:tiny:7z");
  next.push(structuredClone(dup));
  assert.equal(next.length, 48);
  const v = validatePhysicalSession({ session, results: [...next, ...lumina], silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
});

test("unexpected mandatory configuration is rejected", () => {
  const { session, results } = completeMatrix();
  results.push({
    tool: toolMeta("7zip"),
    corpus: { id: "extra" },
    op: "zip-create",
    skipped: false,
    runsRequested: 5,
    runs: [{ warmup: true, valid: true, telemetry: { launcher_ok: true, affinity_applied: true } }, ...Array.from({ length: 5 }, () => goodRun(true))],
    summary: { n: 5, measuredValid: 5, incomplete: false, hash_ok: true },
  });
  const v = validatePhysicalSession({ session, results, silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
  assert.ok(v.reasons.some((x) => /unexpected mandatory key/.test(x)));
});

test("zero mandatory results is rejected", () => {
  const { session } = completeMatrix();
  const v = validatePhysicalSession({ session, results: [], silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
});

test("one valid mandatory result only is rejected", () => {
  const { session, results } = completeMatrix();
  const one = results.filter((r) => configKey(r) === "create:7zip:tiny:zip" || r.tool.id === "lumina");
  const v = validatePhysicalSession({ session, results: one, silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
});

test("Lumina skip rule is strict", () => {
  const { session, results } = completeMatrix();
  const ok = validatePhysicalSession({ session, results, silesiaSha256: PINNED_SILESIA });
  assert.equal(ok.accepted, true);

  const wrong = completeMatrix();
  wrong.results.find((r) => r.tool.id === "lumina").skipReason = "WRONG";
  assert.equal(validatePhysicalSession({ session: wrong.session, results: wrong.results, silesiaSha256: PINNED_SILESIA }).accepted, false);

  const notSkipped = completeMatrix();
  const L = notSkipped.results.find((r) => r.tool.id === "lumina");
  L.skipped = false;
  L.skipReason = "SKIPPED_NOT_LINKED";
  assert.equal(validatePhysicalSession({ session: notSkipped.session, results: notSkipped.results, silesiaSha256: PINNED_SILESIA }).accepted, false);

  const timed = completeMatrix();
  const T = timed.results.find((r) => r.tool.id === "lumina");
  T.skipped = true;
  T.skipReason = "SKIPPED_NOT_LINKED";
  T.runs = [{ warmup: false, valid: true, wall_ms: 12 }];
  T.summary = { n: 1 };
  assert.equal(validatePhysicalSession({ session: timed.session, results: timed.results, silesiaSha256: PINNED_SILESIA }).accepted, false);
});

test("create verification evidence is fail-closed", () => {
  const cases = [
    { verification: { attempted: true, launcher_ok: true, helperFailed: false, exitCode: 0, affinity_applied: false, hash_ok: true } },
    { verification: { attempted: true, launcher_ok: false, helperFailed: false, exitCode: 0, affinity_applied: true, hash_ok: true } },
    { verification: { attempted: true, launcher_ok: true, helperFailed: true, exitCode: 0, affinity_applied: true, hash_ok: true } },
    { verification: { attempted: true, launcher_ok: true, helperFailed: false, exitCode: 1, affinity_applied: true, hash_ok: true } },
    { verification: { attempted: true, launcher_ok: true, helperFailed: false, exitCode: 0, affinity_applied: true, hash_ok: false } },
    { verification: { attempted: false } },
  ];
  for (const patch of cases) {
    const { session, results } = completeMatrix();
    const rec = results.find((r) => configKey(r) === "create:7zip:silesia:zip");
    rec.runs.find((x) => !x.warmup).verification = patch.verification;
    const v = validatePhysicalSession({ session, results, silesiaSha256: PINNED_SILESIA });
    assert.equal(v.accepted, false, JSON.stringify(patch));
  }
});

test("canonical extraction SHA must match across extractors", () => {
  const { session, results } = completeMatrix();
  const a = results.find((r) => configKey(r) === "extract:7zip:silesia:zip:7zip");
  const b = results.find((r) => configKey(r) === "extract:bandizip:silesia:zip:7zip");
  b.archiveSha256 = sha("different");
  b.fixture.archiveSha256 = b.archiveSha256;
  const v = validatePhysicalSession({ session, results, silesiaSha256: PINNED_SILESIA });
  assert.equal(v.accepted, false);
  assert.ok(v.reasons.some((x) => /canonical extract SHA mismatch/.test(x)));

  const ok = completeMatrix();
  const v2 = validatePhysicalSession({ session: ok.session, results: ok.results, silesiaSha256: PINNED_SILESIA });
  assert.equal(v2.accepted, true);
});

test("tool version evidence and bz.exe path are required", () => {
  const a = completeMatrix();
  a.results.find((r) => r.tool.id === "7zip").tool.version = "25.00";
  assert.equal(validatePhysicalSession({ session: a.session, results: a.results, silesiaSha256: PINNED_SILESIA }).accepted, false);

  const b = completeMatrix();
  const bandi = b.results.find((r) => r.tool.id === "bandizip");
  bandi.tool.path = "C:\\\\Program Files\\\\Bandizip\\\\Bandizip.exe";
  assert.equal(validatePhysicalSession({ session: b.session, results: b.results, silesiaSha256: PINNED_SILESIA }).accepted, false);
});

test("physical runner finalization imports renderResultsMd and validator", () => {
  const src = readFileSync(join(import.meta.dirname, "../../bench/scripts/run-physical-session.mjs"), "utf8");
  const renderImport = src.match(/import\s*\{([^}]+)\}\s*from\s*"\.\/render-results\.mjs"/);
  assert.ok(renderImport, "renderResultsMd module import missing");
  assert.match(renderImport[1], /\brenderResultsMd\b/);
  const acceptImport = src.match(/import\s*\{([^}]+)\}\s*from\s*"\.\/accept-baseline\.mjs"/);
  assert.ok(acceptImport, "validatePhysicalSession module import missing");
  assert.match(acceptImport[1], /\bvalidatePhysicalSession\b/);
  assert.match(src, /await renderResultsMd\s*\(/);
  assert.match(src, /validatePhysicalSession\s*\(/);
  assert.match(src, /G1-BASELINE-INVALID/);
  assert.match(src, /process\.exit\(1\)/);
  assert.equal(/await writeJson\([^)]*G1-BASELINE\.json/.test(src.split("if (!validation.accepted)")[0] || ""), false);
});
