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

That script refuses `GITHUB_ACTIONS` and non-Windows hosts. Warmup=1, runs=5,
threadBudget=`min(8, logicalProcessors)`, cache policy `hot-after-single-warmup`.
Tool order rotates per corpus. Lumina is `SKIPPED_NOT_LINKED`.
Raw JSON: `bench/results/<session-id>/`. `RESULTS.md` is generated, never hand-edited.


## G5 Competitive Performance Gate (later)

Same machine, corpus, versions, thread budget, harness. Measure Lumina only
after archive I/O and Adaptive ZIP exist. Marketing claims stay separate.
