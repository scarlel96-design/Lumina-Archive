# G1 bench protocol

G1 is **measurement infrastructure + external competitor baseline**,
not Lumina optimization. Authoritative split: [`docs/BENCHMARKING.md`](../docs/BENCHMARKING.md).

## Authority

| `authority` | Allowed | Competitor baseline (7-Zip/Bandizip/NanaZip)? | Lumina-vs-Bandizip? |
|---|---|---|---|
| `physical-windows` | Fixed lab PC, NVMe, recorded Defender/power/RAM/thread budget | **Yes**, after RESULTS.md review | **No** — that is the **G5** gate |
| `github-runner-not-authoritative` | CI harness smoke | **Never** | **Never** |
| `dev-not-authoritative` | Developer laptop / this sandbox | **Never** | **Never** |

GitHub-hosted runners may validate parsers, pin verification, and a tiny 7-Zip smoke.
They must not be used as the G1 competitor baseline.

## G1 PASS does not require Lumina

Lumina MUST NOT be required for G1 PASS. Archive I/O is not linked until G3/G5.
On every G1 run Lumina must be:

```
SKIPPED_NOT_LINKED
```

That skip **must not** count as a failure and **must not** block G1 PASS.

Do not wait for Adaptive ZIP, minizip-ng, or `lumina-engine` codecs to
close G1. That was the circular dependency: G1 → Lumina I/O → G3/G5 → G2 → G1.

## Physical machine (required for G1 = PASS)

On the **lab Windows PC only** (not GitHub Actions, not this Linux sandbox):

1. `pwsh bench/scripts/collect-machine.ps1` → `bench/machine.local.json`
2. Install outside the repo: 7-Zip 26.02, Bandizip 7.46; NanaZip optional
3. `node bench/scripts/fetch-corpus.mjs` (verifies Silesia SHA-256)
4. `node bench/scripts/run-physical-session.mjs`

Create ZIP-A (7-Zip) and ZIP-B (Bandizip) once per corpus. Every extractor times
those **same archive bytes**. Each extract run uses a clean `extract/.../run-N/`
directory. Exit code 0 without an exact tree match is `valid=false`.
Physical Bandizip is `bz.exe` 7.46 only.


## Thread policy

- **compressionThreadPolicy** = `native-fixed-switch` (`7z -mmt=N`, `bz -t:N` on create only).
- **extractionThreadPolicy** = `FIXED_AFFINITY` on physical Windows via `lumina-bench-run.exe`
  (`CreateProcess` suspended + `SetProcessAffinityMask`). Bandizip `-t` is **not** an extract cap.
- If the helper is missing, policy is `NATIVE_AUTO` and the session **must not** claim extract used `threadBudget`.
  Physical PASS requires the helper.



## G5 Competitive Performance Gate (later)

Same machine, corpus, versions, thread budget, harness. Measure Lumina only
after archive I/O and Adaptive ZIP exist. Marketing claims stay separate.
