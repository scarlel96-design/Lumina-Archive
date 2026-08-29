# STATUS

| Field | Value |
|---|---|
| Spec | v0.2 |
| Phase | **G1 — Physical Windows baseline closure** |
| Updated | 2026-08-29 |
| Product version | 0.0.0-g1 |
| G0 | **PASS** ([windows-native #33242669698](https://github.com/scarlel96-design/Lumina-Archive/actions/runs/33242669698), commit `8882ab2`) |
| G1 harness | **PASS** |
| **G1 overall** | **CONDITIONAL PASS** |
| **Physical Windows baseline** | **INCOMPLETE** |
| **G2 Development Entry** | **BLOCKED** |
| Lumina in G1 | **SKIPPED_NOT_LINKED** (expected; not a failure) |
| Silesia SHA-256 | **RESOLVED** from downloaded bytes (`eng/corpus-pins.json`) |
| G1 circular dependency | **RESOLVED** (ADR-0013) |

## Why not G1 = PASS

This host is Linux (GitHub `windows-latest` is CI only, not a lab PC).
GitHub Actions. Bandizip 7.46 was not run. No `bench/results/<session-id>/`
authoritative JSON exists.

Closed in this turn:

- Canonical extraction fixtures (same bytes to every extractor)
- Unique clean extract destinations; strict path+size+SHA-256
- `lumina-bench-run.exe` FIXED_AFFINITY + process telemetry (bench-only)
- Physical Bandizip must be `bz.exe` 26.02/7.46 fail-closed version check
- Silesia extract via harness 7-Zip resolver
- G1 harness tests including hardening suite

Still required for G1 PASS: lab PC session. Do **not** start G2. Do **not**
run physical baseline until hardening tests are green (they are, on this host).

