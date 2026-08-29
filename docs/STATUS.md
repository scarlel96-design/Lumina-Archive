# STATUS

| Field | Value |
|---|---|
| Spec | v0.2 |
| Phase | **G1 PASS — physical baseline accepted. G2 not started.** |
| Updated | 2026-08-29 |
| Product version | 0.0.0-g1 |
| G0 | **PASS** ([windows-native #33242669698](https://github.com/scarlel96-design/Lumina-Archive/actions/runs/33242669698), commit `8882ab2`) |
| G1 harness | **PASS** |
| **G1 overall** | **PASS** |
| **Physical Windows baseline** | **PASS** |
| **G2 Development Entry** | **READY** |
| Lumina in G1 | **SKIPPED_NOT_LINKED** (expected; not a failure) |
| Silesia SHA-256 | **RESOLVED** from downloaded bytes (`eng/corpus-pins.json`) |
| G1 circular dependency | **RESOLVED** (ADR-0013) |
| Accepted session | `g1-2026-08-29T10-35-59-881Z` |
| Harness commit | `c20b61844907fccd13202a888ff480b22c4bfa69` |
| Machine fingerprint | `fd10fb1bd6fbcd094e8a4b936440bf2456188d4b09a4b91abfa06e0bfcbd3dd4` |
| Baseline artifact | [`bench/G1-BASELINE.json`](../bench/G1-BASELINE.json) `accepted=true` |

## Why G1 = PASS

Independent review of the physical Windows session accepted the full
mandatory 48-key matrix:

- authority `physical-windows`
- 240/240 measured samples valid
- 48/48 warmups valid
- 288/288 mandatory runs valid
- 96/96 create correctness verifications valid
- strict tree hashes true
- launcher_ok / helperFailed=false / affinity_applied=true
- affinity mask `0xff`
- telemetryErrors = 0
- canonical extraction SHA mismatches = 0
- 7-Zip 26.02
- Bandizip 7.46 via `bz.exe`
- Silesia SHA-256 `0626e25f45c0ffb5dc801f13b7c82a3b75743ba07e3a71835a41e3d9f63c77af`
- Lumina `SKIPPED_NOT_LINKED`
- NanaZip optional skipped
- `validation.json` accepted=true, reasons=[]
- no `G1-BASELINE-INVALID.json`

NOISY timing configurations remain under the established CV > 5% rule.
They are measurement-quality flags, not G1 failures. Do not drop outliers.

G2 Development Entry is **READY**. This closure commit does **not** start G2.
Lumina-vs-Bandizip remains **G5**. Do not claim Lumina is faster than Bandizip.

G0 native compile on this Linux preview host remains **BLOCKED BY ENVIRONMENT**.
Windows GitHub `windows-latest` is the G0 native evidence, not a G1 competitor baseline.

