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
| G1 freeze candidate | superseded `0154450` (renderResultsMd unbound; 48-key matrix not enforced). Next freeze after this hotfix + CI. |

## Why not G1 = PASS

This host is Linux (GitHub `windows-latest` is CI only, not a lab PC).
GitHub Actions. Bandizip 7.46 was not run. No `bench/results/<session-id>/`
authoritative JSON exists.

Closed in this turn:

- Create-order rotation (`rotateCreateProducers`)
- Fixture setup isolated from timed create/extract and warmup
- Cache policy `hot-cache-explicit-warmup-1` (honest, not cold-cache)
- Affinity fail-closed (no resume if SetProcessAffinityMask fails; multi-group rejected)
- PrivateUsage named `private_usage_bytes_at_exit`; `peak_private_bytes` always null
- Helper launcher_ok vs child exit

Still required for G1 PASS: lab PC session. Do **not** start G2. Do **not**
run physical baseline from this environment.


