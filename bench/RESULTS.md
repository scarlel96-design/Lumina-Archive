# Bench results

G1 **external competitive baseline** ledger. Raw JSON is authoritative.
Do not hand-edit numbers. Lumina is SKIPPED_NOT_LINKED and is **not** in
performance tables. You must not claim “faster than Bandizip”. That
sentence is not authorized by G1. Lumina-vs-Bandizip is the **G5** gate.

## Authoritative physical Windows

- Session: `g1-2026-08-29T10-35-59-881Z`
- Authority: `physical-windows`
- Harness: `c20b61844907fccd13202a888ff480b22c4bfa69`
- Machine fingerprint: `fd10fb1bd6fbcd094e8a4b936440bf2456188d4b09a4b91abfa06e0bfcbd3dd4`
- Acceptance: `accepted=true` (`bench/G1-BASELINE.json`)
- Mandatory matrix: 48 unique configurations, 240/240 measured valid
- Create verifications: 96/96
- Canonical extract SHA mismatches: 0
- Tools: 7-Zip 26.02, Bandizip 7.46 (`bz.exe`)
- Lumina: SKIPPED_NOT_LINKED
- NanaZip: optional skipped
- NOISY: present as CV>5% quality flags; not removed

Per-run medians/p95 live in the lab-PC session `all.json`. This repository
stores the sanitized acceptance ledger only. Do not invent timings here.

## CI / dev harness (not evidence)

Leave this section empty of medians. Smoke JSON lives in `bench/out/` (gitignored).
GitHub Actions timings are never the competitor baseline.
