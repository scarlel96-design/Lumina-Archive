# Bench results

No competitive numbers yet. G1 fills this table **only** from a
`authority=physical-windows` JSON run on a fixed NVMe PC.

Do **not** copy GitHub Actions timings here as Bandizip-vs-Lumina evidence.
You must not claim “faster than Bandizip” until the marketing gate in the spec is met.

## Authoritative physical Windows (empty)

| tool | version | corpus | preset | median_s | p95_s | mbps | output_bytes | peak_wss | hash_ok | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 7-Zip | 26.02 | — | — | — | — | — | — | — | — | not run on lab PC |
| NanaZip | 6.5.1800 | — | — | — | — | — | — | — | — | not run on lab PC |
| Bandizip | 7.46 | — | — | — | — | — | — | — | — | not run on lab PC |
| Lumina | 0.0.0-g1 | — | — | — | — | — | — | — | — | engine not linked (G1 skip) |

## CI / dev harness (not evidence)

Leave this section empty of medians. Smoke JSON lives in `bench/out/` (gitignored).
