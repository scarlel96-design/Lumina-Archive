/** Compression can use native -mmt / -t:N. Extraction must not pretend -t:N applies. */
export const COMPRESSION_THREAD_POLICY = "native-fixed-switch";
export const EXTRACTION_THREAD_POLICY_AFFINITY = "FIXED_AFFINITY";
export const EXTRACTION_THREAD_POLICY_AUTO = "NATIVE_AUTO";

export function affinityMask(threadBudget) {
  const n = Math.max(1, Math.min(64, Number(threadBudget) || 1));
  if (n >= 64) return "0xFFFFFFFFFFFFFFFF";
  return "0x" + ((1n << BigInt(n)) - 1n).toString(16).toUpperCase();
}

export function extractionPolicy(helperPath) {
  if (helperPath) {
    return {
      extractionThreadPolicy: EXTRACTION_THREAD_POLICY_AFFINITY,
      usesFixedThreadBudget: true,
    };
  }
  return {
    extractionThreadPolicy: EXTRACTION_THREAD_POLICY_AUTO,
    usesFixedThreadBudget: false,
    note: "Bandizip/7-Zip extraction is not claimed to use compression -t/-mmt",
  };
}

export function assertNoFalseExtractThreads(record) {
  if (record.op?.includes("extract") && record.extractionThreadPolicy === EXTRACTION_THREAD_POLICY_AUTO) {
    if (record.claimedFixedExtractThreads === true) {
      throw new Error("must not claim extraction used fixed threadBudget under NATIVE_AUTO");
    }
  }
}
