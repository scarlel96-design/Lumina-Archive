# Bench results

G1 fills **competitor** rows only from `authority=physical-windows` JSON
on a fixed NVMe PC. Lumina is `SKIPPED_NOT_LINKED` until G5.

Do **not** copy GitHub Actions timings here as a competitor baseline.
You must not claim “faster than Bandizip” until the **marketing** gate
(not G1) in the spec is met. Lumina-vs-Bandizip is the **G5** gate.

## Authoritative physical Windows (empty)

| tool | version | corpus | preset | median_s | p95_s | mbps | output_bytes | peak_wss | hash_ok | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 7-Zip | 26.02 | — | — | — | — | — | — | — | — | not run on lab PC |
| NanaZip | 6.5.1800 | — | — | — | — | — | — | — | — | not run on lab PC |
| Bandizip | 7.46 | — | — | — | — | — | — | — | — | not run on lab PC |
| Lumina | 0.0.0-g1 | — | — | — | — | — | — | — | — | SKIPPED_NOT_LINKED (expected in G1) |

## CI / dev harness (not evidence)

Leave this section empty of medians. Smoke JSON lives in `bench/out/` (gitignored).
