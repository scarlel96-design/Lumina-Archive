# Bench harness (G1)

Reproducible measurement only. No Adaptive ZIP. No product UI. No codec link.

| Path | Role |
|---|---|
| `../docs/BENCHMARKING.md` | G1 vs G5 gate split |
| `PROTOCOL.md` | authority + physical-machine checklist |
| `corpus.manifest.json` | fixed corpora |
| `result.schema.json` | JSON records |
| `scripts/run-harness.mjs` | runner, pinned `--threads` |
| `scripts/parsers.mjs` | 7-Zip / NanaZip / Bandizip / Lumina |
| `scripts/fetch-vendors.mjs` | official artifacts + SHA-256 verify |
| `scripts/verify-pins.mjs` | `eng/versions.json` vs `eng/vendor-pins.json` |
| `RESULTS.md` | **no invented timings** |
| `fixtures/tiny` | CI smoke corpus |

```bash
node bench/scripts/verify-pins.mjs
node bench/scripts/parsers.test.mjs
node bench/scripts/run-harness.mjs --authority=dev-not-authoritative --tools=7zip,lumina --corpus=tiny --warmup=1 --runs=2 --threads=2
node bench/scripts/summarize.mjs
```

Bandizip binaries stay **outside** this repository.
