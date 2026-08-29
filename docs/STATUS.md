# STATUS

| Field | Value |
|---|---|
| Spec | v0.2 |
| Phase | **G0 — Constitution** |
| Updated | 2026-08-29 |
| Product version | 0.0.0-g0 |
| Grok Build Linux host | MSVC still **BLOCKED BY ENVIRONMENT** (not used as evidence) |
| Verification environment | GitHub Actions `windows-latest` |
| **G0** | **PASS** |
| **G1 ENTRY** | **READY** |

## Evidence

Green Windows job (do not treat Linux/web as substitute):

- Run: https://github.com/scarlel96-design/Lumina-Archive/actions/runs/33242669698
- Commit: `8882ab2`
- Workflow: `windows-native` / job `g0-windows`
- Duration: 3m0s
- Conclusion: success

| Check | Result |
|---|---|
| `dotnet restore LuminaArchive.sln` | PASS |
| Domain build | PASS |
| Supervisor build | PASS |
| CLI build | PASS |
| Tests build | PASS |
| WinUI skeleton build | PASS |
| Domain tests | PASS |
| `cmake --preset windows-x64-release` | PASS (VS 18 2026) |
| `cmake --preset windows-arm64-release` | PASS (configure) |
| MSVC `lumina-engine` | PASS |
| MSVC `lumina-preview` | PASS |
| MSVC `lumina-shell` | PASS |
| MSVC `lumina-7z-adapter` | PASS |
| Constitution tests | PASS |
| Dependency-boundary audit | PASS |
| Packaging-boundary audit | PASS |

## G0 defects closed on the Windows gate

1. NU1605 — pin `Microsoft.Windows.SDK.BuildTools` to `10.0.26100.4654` (WASDK 2.4.0).
2. CS7022/CS8321 — wrap CLI `Main` in `Lumina.Cli.Program`.
3. CMake generator — `windows-latest` is VS 18 Enterprise; presets use `Visual Studio 18 2026`.

## Unresolved (not G0 blockers)

- Node.js 20 deprecation annotation on `actions/checkout@v4` and setup actions (forced to Node 24). Warning only.
- Codec SHA-256 pins remain `PENDING_OFFICIAL_ARTIFACT` (G1 vendor/hash work).
- ARM64 native was **configured**, not cross-built as a release artifact.

## Next

G1 may begin only when an operator starts it. This STATUS update does **not** start G1.
Do not implement Adaptive ZIP, codecs, production archive I/O, or product UI until G1 is explicitly opened.
