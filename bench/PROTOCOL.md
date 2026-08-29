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

1. Copy `machine.example.json` → `machine.local.json` (gitignored).
2. Fill: CPU, logical cores, RAM, NVMe/storage, Windows version, power mode,
   Defender realtime, `threadBudget`.
3. Install **outside the repo**:
   - 7-Zip 26.02 (official)
   - Bandizip 7.46 (never committed)
   - NanaZip 6.5.1800 when available
4. Fetch Silesia with `fetch-corpus` and record SHA-256 from downloaded bytes.
5. `node bench/scripts/verify-pins.mjs`
6. `node bench/scripts/run-harness.mjs --authority=physical-windows --tools=7zip,bandizip,nanazip --corpus=tiny,silesia,incompressible-64m --warmup=1 --runs=5 --threads=<fixed> --op=zip-create`
7. Repeat `--op=zip-extract` on archives from step 6.
8. Warm-up 1 + ≥5 timed runs. Store median, p95, hashes.
9. Lumina, if listed, must appear as `SKIPPED_NOT_LINKED`.
10. Only then fill the **competitor** rows in `RESULTS.md`.

## G5 Competitive Performance Gate (later)

Same machine, corpus, versions, thread budget, harness. Measure Lumina only
after archive I/O and Adaptive ZIP exist. Marketing claims stay separate.
