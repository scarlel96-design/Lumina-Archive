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

## Why not G1 = PASS

GitHub-hosted `windows-latest` / Ubuntu runners validated the **harness**, not Bandizip-vs-Lumina.
A fixed physical Windows NVMe machine with recorded Defender/power/thread budget
has **not** been run. That remains required for full G1 PASS.

## G1 delivered

- Corpus catalog + tiny/encoding/hostile fixtures
- Runner with pinned `--threads`, warmup + N runs, median/p95
- Parsers: 7-Zip, NanaZip, Bandizip, Lumina (`not-linked` skip)
- Result schema + authority enum
- Official vendor SHA-256 pins in `eng/vendor-pins.json` / `eng/versions.json` (downloaded bytes, 2026-08-29)
- Bandizip never vendored
- CI: `bench-harness.yml` linux/windows smoke with `github-runner-not-authoritative`
- Lumina archive I/O **not** implemented (G3/G5)

## Unresolved

- Physical Windows RESULTS.md rows still empty
- Silesia corpus sha256 still `PENDING_OFFICIAL_ARTIFACT` until first physical fetch
- Codec libraries are pinned, **not linked** into `lumina-engine` (`LUMINA_ENABLE_CODECS=OFF`)
- Node 20 deprecation warning on Actions

## Next

Do **not** start G2 until an operator records physical-windows JSON and this STATUS
is updated to G1 = PASS, or an operator explicitly accepts the remaining blocker.
