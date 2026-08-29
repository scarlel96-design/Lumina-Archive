# Architecture Decision Records

Format: date, status, context, decision, consequences.

## ADR-0001 — Native WinUI 3 + C++ engine, not a web shell

- Date: 2026-08-29
- Status: accepted
- Context: Grok Build’s hosted preview is a web app. Shipping ZIP in the browser would be easier here.
- Decision: Product source of truth is WinUI 3 + .NET 10 + out-of-process C++. The hosted preview is a constitution dashboard only.
- Consequences: Native build is BLOCKED in this Linux host. That is reported, not worked around with Electron/Tauri.

## ADR-0002 — 7z.dll callbacks, not 7zz CLI, on the production path

- Date: 2026-08-29
- Status: accepted
- Context: v0.1 used 7zz argv. Passwords, pause, cancel, and progress are weakly controlled on CLI.
- Decision: Production talks to unmodified official `7z.dll` in `lumina-engine.exe`. 7zz is bench/dev/no-secret fallback only.
- Consequences: Need a versioned IPC and a 7z adapter isolated for LGPL.

## ADR-0003 — minizip-ng owns ZIP; libzip is removed

- Date: 2026-08-29
- Status: accepted
- Context: v0.1 split ZIP edit (libzip) from ZIP create (Fast ZIP).
- Decision: minizip-ng 4.2.2 is the ZIP container layer (create, extract, edit, AES, ZIP64, raw-entry, recovery).
- Consequences: One ZIP parser/writer to fuzz and license. zlib-ng/ISA-L/libdeflate remain codecs only.

## ADR-0004 — Windows 11 certified, Windows 10 compatibility

- Date: 2026-08-29
- Status: accepted
- Context: Windows 10 Home/Pro 22H2 general support ended 2025-10-14.
- Decision: Quality gates are Windows 11. Windows 10 ESU/LTSC is a compatibility tier with fallbacks, not a reason to drop Mica/packaging features.
- Consequences: CI must matrix Win11 x64/ARM64 as required; Win10 as extra.

## ADR-0005 — Job Object + secret pipe + journal instead of JSONL-over-stdio

- Date: 2026-08-29
- Status: accepted
- Context: stdin/stdout JSONL is fine for benches, not for secrets or crash recovery.
- Decision: Length-prefixed UTF-8 JSON on a control Named Pipe; one-shot secret pipe; heartbeat; recovery journal.
- Consequences: G2 must land before G3/G5.

## ADR-0006 — Adaptive ZIP and parallel ZIP extract are P0

- Date: 2026-08-29
- Status: accepted
- Context: Bandizip 7.46 already fast-archives incompressible files and parallel-extracts eligible ZIP on SSD.
- Decision: These are v1 competition features, not post-1.0 polish.
- Consequences: G5 is gated on benches, not on “looks fast in the UI”.

## ADR-0007 — No EGG; ALZ only as a licensed P1 plugin

- Date: 2026-08-29
- Status: accepted
- Context: Korean users need ALZ/EGG compatibility vs Bandizip. ESTsoft UnEGG sources carry commercial-use limits.
- Decision: Do not ship EGG until an independently licensed implementation exists. ALZ may enter as a P1 plugin after license audit.
- Consequences: Do not advertise “40 formats” that we have not tested.

## ADR-0008 — SHA-256 pins stay PENDING until official artifacts are hashed

- Date: 2026-08-29
- Status: accepted
- Context: Inventing hashes would hide a supply-chain hole.
- Decision: `PENDING_OFFICIAL_ARTIFACT` is an explicit G1 blocker.
- Consequences: Release CI fails if any runtime dependency still has that token.

## ADR-0009 — G0 WinUI is unpackaged; .NET sln does not contain CMake

- Date: 2026-08-29
- Status: accepted
- Context: MSIX without assets and a CMake project inside the .sln make `dotnet restore/build` fail on windows-latest.
- Decision: G0 WinUI uses `WindowsPackageType=None`. Native builds only through CMake presets. MSIX returns in G8.
- Consequences: `dotnet build LuminaArchive.sln` is a C# graph. CI still configures both Windows CMake presets.

## ADR-0010 — Windows SDK BuildTools follows WASDK 2.4.0

- Date: 2026-08-29
- Status: accepted
- Context: G0 Windows restore failed NU1605: `Microsoft.WindowsAppSDK 2.4.0` requires `Microsoft.Windows.SDK.BuildTools >= 10.0.26100.4654`, but the skeleton pinned `10.0.26100.1742`.
- Decision: Pin BuildTools to `10.0.26100.4654`. Do not suppress NU1605.
- Consequences: WinUI restore on windows-latest matches WASDK 2.4.0.

## ADR-0011 — CMake Windows presets target VS 18 2026

- Date: 2026-08-29
- Status: accepted
- Context: GitHub `windows-latest` has Visual Studio 18 Enterprise and CMake 4.4.2. Generator `Visual Studio 17 2022` failed: "could not find any instance of Visual Studio."
- Decision: Default Windows presets use `Visual Studio 18 2026`. Keep `windows-x64-release-vs17` as a local fallback. CI configures `windows-x64-release` and `windows-arm64-release`.
- Consequences: G0 native builds follow the runner that actually exists in 2026.
