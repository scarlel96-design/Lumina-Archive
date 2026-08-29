# G1 bench protocol

G1 is **measurement infrastructure**, not optimization.

## Authority

| `authority` | Allowed | Bandizip-vs-Lumina evidence? |
|---|---|---|
| `physical-windows` | Fixed lab PC, NVMe, recorded Defender/power/thread budget | **Yes**, after RESULTS.md review |
| `github-runner-not-authoritative` | CI harness smoke | **Never** |
| `dev-not-authoritative` | Developer laptop / this sandbox | **Never** |

GitHub-hosted runners may validate parsers, pin verification, and a tiny 7-Zip smoke.
They must not be used as the competitive baseline.

## Physical machine (required for G1 = PASS)

1. Copy `machine.example.json` → `machine.local.json` (gitignored).
2. Pin `threadBudget` (default 8 or `min(8, logicalCores)`).
3. Record Defender realtime, power plan, CPU, NVMe model.
4. Install **outside the repo**:
   - 7-Zip 26.02 (official)
   - NanaZip 6.5.1800 (optional reference)
   - Bandizip 7.46 (never committed)
5. `node bench/scripts/verify-pins.mjs`
6. `node bench/scripts/run-harness.mjs --authority=physical-windows --tools=7zip,nanazip,bandizip,lumina --corpus=tiny,silesia,incompressible-64m --warmup=1 --runs=5 --threads=8 --op=zip-create`
7. Repeat `--op=zip-extract` on archives produced in step 6.
8. Warm-up 1 + ≥5 timed runs. Store median and p95.
9. Only then edit `RESULTS.md` from those JSON files.

Lumina archive I/O is **skipped** until G3/G5. A skip is not a timing.

## Marketing claim (separate from G1)

ZIP create geometric mean ≥ 1.05× Bandizip 7.46 **and** eligible parallel extract geometric mean ≥ 1.00× on the **fixed** corpus. Cherry-picks are forbidden. G1 does not make this claim.
