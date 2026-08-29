# Benchmarking gates

This document splits **G1 infrastructure + external baseline** from the
**G5 Lumina-vs-Bandizip competitive gate**. Mixing them created a circular
dependency (G1 required Lumina I/O which does not exist until G3/G5).

## G1 — harness and external competitor baseline

G1 validates the measurement system and records **7-Zip / Bandizip / NanaZip**
on one fixed physical Windows machine. It does **not** measure Lumina.

Full **G1 = PASS** requires all of:

1. G1 harness unit tests PASS
2. Linux and Windows harness smoke PASS (`authority=github-runner-not-authoritative`)
3. A fixed physical Windows benchmark session exists
4. Machine metadata recorded: CPU, logical cores, RAM, NVMe/storage, Windows
   version, power mode, Defender realtime, fixed thread budget
5. External baseline completed for 7-Zip 26.02 and Bandizip 7.46;
   NanaZip 6.5.1800 when available
6. `warmup = 1`
7. Measured runs ≥ 5
8. Median and p95 recorded
9. Output hashes / correctness checks PASS
10. Silesia artifact SHA-256 resolved from **downloaded bytes**
    (`eng/corpus-pins.json`, 2026-08-29)
11. Results use `authority=physical-windows`
12. Bandizip binary remains **outside** the repository

**Lumina is not required for G1 PASS.** Expected Lumina row:

`SKIPPED_NOT_LINKED`

That skip is success, not a failure. Archive I/O is linked in G3/G5.

GitHub-hosted runners may only prove the harness. They are never the
authoritative competitor baseline.

Accepted G1 physical session: `g1-2026-08-29T10-35-59-881Z`
(harness `c20b61844907fccd13202a888ff480b22c4bfa69`, fingerprint
`fd10fb1bd6fbcd094e8a4b936440bf2456188d4b09a4b91abfa06e0bfcbd3dd4`).
See `bench/G1-BASELINE.json`. G2 is READY and is not started by G1 closure.


## G5 — Competitive Performance Gate

Moved out of G1:

> Bandizip-vs-Lumina competitive benchmark

G5 reuses the **same** fixed machine, corpus, tool versions, thread budget,
and harness that established the G1 baseline. Only after Lumina archive I/O
and Adaptive ZIP exist may Lumina be timed against that baseline.

Engineering targets (from spec): Fast ZIP create vs Bandizip 7.46 on the
fixed corpus; eligible parallel extract vs Bandizip or vs own-serial.

## Marketing (not a phase gate)

Public “faster than Bandizip” additionally requires ZIP create geometric
mean ≥ 1.05× and eligible parallel extract geometric mean ≥ 1.00× on the
**entire** fixed corpus. Cherry-picks are forbidden. Neither G1 nor a green
CI job authorizes that sentence.
