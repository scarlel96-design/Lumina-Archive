# STATUS

| Field | Value |
|---|---|
| Spec | v0.2 |
| Phase | **G0 — Constitution + Windows verification wiring** |
| Updated | 2026-08-29 |
| Product version | 0.0.0-g0 |
| This Grok Build host (Linux) | MSVC / .NET 10 / WASDK **BLOCKED BY ENVIRONMENT** |
| Verification environment | GitHub Actions `windows-latest` (`.github/workflows/windows-native.yml`) |
| Gate on this host | **CONDITIONAL PASS** until a green Windows Actions run is attached |
| G1 entry | **BLOCKED** |

## G0 Windows verification checklist

| Check | Wiring | Executed here |
|---|---|---|
| Restore `LuminaArchive.sln` | workflow step | no (no .NET SDK) |
| Configure windows-x64 + windows-arm64 CMake presets | workflow step | no (no CMake/MSVC) |
| Build Domain, Supervisor, CLI, WinUI, tests | workflow step | no |
| Build lumina-engine, 7z-adapter, preview, shell | workflow `--target` | stub only via g++ (engine) |
| Constitution tests | node 8+ tests | **yes, local node** |
| Shell parser / codec boundary | `eng/g0-windows-audit.ps1` + node | **yes, node** |
| UI has no codec PackageReference | tests | **yes** |
| 7zz not production path | tests | **yes** |
| secrets not in argv/env | tests | **yes** |
| npm/web preview not in Win packaging | tests | **yes** |

## Structural defects closed on this turn

- CMake project removed from `.sln` so `dotnet restore` is a .NET-only graph.
- Solution `Release\|x64` now has `Build.0` for Domain/Supervisor/CLI/Win/Tests.
- WinUI G0 is unpackaged (`WindowsPackageType=None`); MSIX stays G8.
- CMake Windows build presets set `--config Release`.
- `global.json` uses `10.0.100` + `latestFeature` so `10.0.x` runners restore.
- `nuget.config` pins nuget.org.

## Next

G1 starts only after GitHub Actions job `g0-windows` is green and this STATUS
is updated with the run URL. Do not implement Adaptive ZIP or product UI.
