# G1 accepted physical session

- Session: `g1-2026-08-29T10-35-59-881Z`
- Authority: `physical-windows`
- Harness: `c20b61844907fccd13202a888ff480b22c4bfa69`
- Machine fingerprint: `fd10fb1bd6fbcd094e8a4b936440bf2456188d4b09a4b91abfa06e0bfcbd3dd4`
- `validation.json`: `accepted=true`, `reasons=[]`
- `G1-BASELINE.json`: `accepted=true`
- No `G1-BASELINE-INVALID.json`

Independent review confirmed the 48-key mandatory matrix, 240/240 measured
samples, 48/48 warmups, 288/288 mandatory runs, 96/96 create verifications,
strict tree hashes, helper/affinity evidence, canonical extract SHAs, 7-Zip
26.02, Bandizip 7.46 via `bz.exe`, pinned Silesia SHA-256, Lumina
`SKIPPED_NOT_LINKED`, NanaZip optional skip.

NOISY timing flags remain measurement-quality markers under CV > 5%. They
are not a G1 acceptance failure. Do not delete outliers. Do not hand-edit
numbers. Do not claim Lumina is faster than Bandizip. Competitive compare
is G5.

Raw per-run JSON (`all.json` and individual result files) remains
authoritative on the lab PC session directory. This repository stores the
sanitized acceptance ledger only: no corpus payloads, no vendor/cache, no
Bandizip/7-Zip binaries, no `machine.local.json`, no `bench/out` trees.
