# Lumina Archive

Original Windows archive manager. Competitive baseline: Bandizip 7.46.
Native stack: **WinUI 3 + .NET 10 + C++ engine**. This repository’s web
preview (if hosted on Grok Build) is a **constitution dashboard**, not
the product.

| Now | Next |
|---|---|
| Phase G1 — Bench harness (CONDITIONAL PASS) | Phase G2 — blocked until physical Windows RESULTS |

Read [AGENTS.md](AGENTS.md), [docs/LUMINA_SPEC_v0.2.md](docs/LUMINA_SPEC_v0.2.md),
[docs/STATUS.md](docs/STATUS.md).

## Windows build (required for the real app)

```
dotnet --version   # 10.0.11+
cmake --preset windows-x64-release
cmake --build --preset windows-x64-release
dotnet build LuminaArchive.sln -c Release
```

Linux/macOS hosts: native compile is **BLOCKED BY ENVIRONMENT**. Run
`node --test tests/constitution/g0.test.mjs` instead.
