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

- Silesia `silesia.zip` fetched from `https://sun.aei.polsl.pl/~sdeor/corpus/silesia.zip`
  (68182744 bytes, SHA-256 `0626e25f45c0ffb5dc801f13b7c82a3b75743ba07e3a71835a41e3d9f63c77af`)
- Deterministic `incompressible-64m`
- Physical session runner, machine collector, stats, rotation, RESULTS renderer, freeze manifest
- GitHub Actions cannot claim `physical-windows`

Still required for G1 PASS: one lab PC run of
`pwsh bench/scripts/collect-machine.ps1` then
`node bench/scripts/run-physical-session.mjs`
with 7-Zip 26.02 and Bandizip 7.46 **outside** the repo.

Do **not** start G2. Do **not** link codecs. Do **not** time Lumina.
