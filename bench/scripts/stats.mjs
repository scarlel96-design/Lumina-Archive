export function summarizeTimes(values) {
  if (!values.length) {
    return {
      n: 0,
      median: null,
      p95: null,
      mean: null,
      min: null,
      max: null,
      stdev: null,
      cv: null,
      noisy: false,
    };
  }
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const mid = Math.floor(n / 2);
  const median = n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  const p95 = s[Math.max(0, Math.min(n - 1, Math.ceil(0.95 * n) - 1))];
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  const cv = mean === 0 ? null : stdev / mean;
  return {
    n,
    median,
    p95,
    mean,
    min: s[0],
    max: s[n - 1],
    stdev,
    cv,
    noisy: cv != null && cv > 0.05,
  };
}
