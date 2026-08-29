# STATUS

| Field | Value |
|---|---|
| Spec | v0.2 |
| Phase | **G1 — Reproducible Archive Benchmark Harness** |
| Updated | 2026-08-29 |
| Product version | 0.0.0-g1 |
| G0 | **PASS** ([windows-native #33242669698](https://github.com/scarlel96-design/Lumina-Archive/actions/runs/33242669698), commit `8882ab2`) |
| **G1** | **CONDITIONAL PASS** |
| **G2 Development Entry** | **BLOCKED** |
| Physical Windows baseline | **MISSING** |
| Lumina in G1 | **SKIPPED_NOT_LINKED** (expected; not a failure) |
| G1 circular dependency | **RESOLVED** (ADR-0013) |

Gate split: [`docs/BENCHMARKING.md`](BENCHMARKING.md).

## Why not G1 = PASS

Harness unit tests and GitHub `windows-latest` / Ubuntu smokes **PASS**.
The remaining G1 blocker is the **external competitor baseline** on a fixed
physical Windows PC (7-Zip 26.02, Bandizip 7.46, NanaZip if present), plus
Silesia SHA-256 from downloaded bytes.

Lumina archive I/O is **not** a G1 requirement. Competitive Lumina-vs-Bandizip
is the **G5** gate, on this same machine/harness.

## G1 delivered

- Corpus catalog + tiny/encoding/hostile fixtures
- Runner with pinned `--threads`, warmup + N runs, median/p95
- Parsers: 7-Zip, NanaZip, Bandizip, Lumina (`SKIPPED_NOT_LINKED`)
- Result schema + authority enum
- Official vendor SHA-256 pins in `eng/vendor-pins.json` / `eng/versions.json`
- Bandizip never vendored
- CI: `bench-harness.yml` linux/windows smoke (`github-runner-not-authoritative`)
- Codec libraries pinned, **not linked** (`LUMINA_ENABLE_CODECS=OFF`)

## Unresolved (G1 PASS blockers)

- Physical Windows RESULTS.md competitor rows still empty
- Silesia corpus sha256 still `PENDING_OFFICIAL_ARTIFACT`
- Node 20 deprecation warning on Actions (not a G1 blocker)

## Next

Do **not** start G2 until an operator records `authority=physical-windows`
competitor JSON (7-Zip + Bandizip, NanaZip if available) and this STATUS
becomes G1 = PASS.

Do **not** implement Adaptive ZIP or Lumina archive I/O to close G1.
Do **not** start G5 competitive claims from G1.
