export const PINNED_SILESIA = "0626e25f45c0ffb5dc801f13b7c82a3b75743ba07e3a71835a41e3d9f63c77af";

export function isMandatoryResult(r) {
  if (!r) return false;
  if (r.tool?.id === "lumina") return false;
  if (r.tool?.id === "nanazip") return false;
  if (r.skipped && /NanaZip/i.test(r.skipReason || "")) return false;
  return ["zip-create", "zip-extract", "7z-create", "7z-extract"].includes(r.op);
}

export function validatePhysicalSession({ session, results, silesiaSha256 }) {
  const reasons = [];
  if (session?.authority !== "physical-windows") reasons.push("authority != physical-windows");
  if ((silesiaSha256 || session?.silesiaSha256) !== PINNED_SILESIA) reasons.push("Silesia SHA-256 mismatch");
  const list = Array.isArray(results) ? results : [];
  for (const r of list) {
    if (r.tool?.id === "lumina") {
      if (r.skipReason !== "SKIPPED_NOT_LINKED" && r.skipped !== true) {
        reasons.push("Lumina must be SKIPPED_NOT_LINKED");
      }
      continue;
    }
    if (!isMandatoryResult(r)) continue;
    const requested = r.runsRequested ?? 5;
    const validN = r.summary?.measuredValid ?? 0;
    if (requested !== 5) reasons.push(`${label(r)} runsRequested != 5`);
    if (validN !== 5) reasons.push(`${label(r)} measuredValid=${validN} != 5`);
    if (r.summary?.incomplete !== false) reasons.push(`${label(r)} incomplete`);
    if (r.summary?.n !== 5) reasons.push(`${label(r)} summary.n != 5`);
    if (r.summary?.hash_ok !== true) reasons.push(`${label(r)} correctness failed`);
    const measured = (r.runs || []).filter((x) => !x.warmup);
    if (measured.some((x) => x.valid !== true)) reasons.push(`${label(r)} measured sample invalid`);
  }
  if (!list.some(isMandatoryResult)) reasons.push("no mandatory results");
  return { accepted: reasons.length === 0, reasons };
}

function label(r) {
  return `${r.tool?.id || "?"} ${r.corpus?.id || "?"} ${r.op || "?"}`;
}
