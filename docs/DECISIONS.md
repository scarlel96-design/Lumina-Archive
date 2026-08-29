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

## ADR-0012 — G1 harness authority is physical Windows only

- Date: 2026-08-29
- Status: superseded by ADR-0013
- Context: GitHub-hosted runners can validate parsers and 7-Zip smoke, but they are not a fixed NVMe PC with a recorded Defender/power state.
- Decision: `authority=github-runner-not-authoritative` is allowed for harness CI. Competitor baseline numbers require `authority=physical-windows`. Bandizip is never vendored. Official SHA-256 pins are computed from downloaded bytes, never invented.
- Consequences: Originally stated G1 PASS after lab-PC RESULTS including Bandizip-vs-Lumina. That mixed G5 into G1 and is corrected by ADR-0013.

## ADR-0013 — G1 does not require Lumina I/O; competitive compare is G5

- Date: 2026-08-29
- Status: accepted
- Context: G1 full PASS had required a physical Bandizip-vs-Lumina run while `PROTOCOL.md` correctly said Lumina archive I/O is unlinked until G3/G5, and G2 was blocked on G1 PASS. That is a cycle: G1 → Lumina I/O → G3/G5 → G2 → G1.
- Decision:
  - G1 PASS = harness tests + Linux/Windows smoke + physical Windows **external** baseline (7-Zip 26.02, Bandizip 7.46, NanaZip when available). Lumina row must be `SKIPPED_NOT_LINKED` and that skip is success.
  - Bandizip-vs-Lumina competitive benchmark is the **G5 Competitive Performance Gate**, using the same machine/corpus/versions/thread budget/harness.
  - Marketing “faster than Bandizip” remains a separate claim, not authorized by G1.
- Consequences: G2 may start after G1 PASS without any Lumina codec. Physical session `g1-2026-08-29T10-35-59-881Z` is the accepted G1 baseline (ADR-0014). See `docs/BENCHMARKING.md`.

## ADR-0014 — G1 physical Windows baseline accepted

- Date: 2026-08-29
- Status: accepted
- Context: Session `g1-2026-08-29T10-35-59-881Z` on harness `c20b61844907fccd13202a888ff480b22c4bfa69` was independently reviewed: 48 unique mandatory configs, 240/240 measured valid, helper/affinity/tree/canonical-SHA evidence complete, Lumina `SKIPPED_NOT_LINKED`.
- Decision: G1 = PASS. Physical Windows Baseline = PASS. G2 Development Entry = READY. NOISY CV>5% flags stay in the record. Marketing Lumina-vs-Bandizip remains G5. Do not start G2 in the closure commit.
- Consequences: Later G5 must reuse this machine fingerprint `fd10fb1bd6fbcd094e8a4b936440bf2456188d4b09a4b91abfa06e0bfcbd3dd4`, corpus pins, tool versions, thread budget, and harness protocol. Raw JSON on the lab PC remains authoritative for timings.

## ADR-0015 — G2 Named Pipe IPC, Job Object containment, secret pipe

- Date: 2026-08-29
- Status: accepted
- Context: G2 must prove process isolation and transport before any codec is linked.
- Decision:
  - Control IPC is local Named Pipe, `uint32le` + strict UTF-8 JSON, protocol version 1, 1 MiB max frame.
  - Envelope requires `payload`. Sequence is contiguous per direction.
  - Pipe ACL is current-user only. Client PID must match the launched worker on control and secret pipes.
  - Worker is created `CREATE_SUSPENDED`, assigned to a Job Object with `KILL_ON_JOB_CLOSE` (and active-process 1), then resumed.
  - Secret pipe is a one-shot binary frame (64 KiB max), wiped after use. Native IPC JSON is nlohmann/json 3.12.0 (ADR-0016). C# uses `System.Text.Json`.
  - Pause is cooperative (`paused`/`resumed` events). Heartbeat continues while paused. Watchdog uses `TimeProvider`.
  - Journal is atomic snapshot JSON; Running/Paused recover as Interrupted.
  - ResourceGovernor is a **strict FIFO** global lease: new requests join the queue when waiters exist; drain from head only; cancelled head is removed then the next head is evaluated. Not a hard Job Object memory kill.
- Consequences: G3 may pass secrets into 7z.dll callbacks over this pipe. G2 Windows integration is required for full PASS. Linux preview remains dashboard-only.

## ADR-0016 — nlohmann/json 3.12.0 for native IPC envelopes

- Date: 2026-08-29
- Status: accepted
- Context: The G2 handwritten `protocol.cpp` parser accepted missing/trailing commas, substring-matched `secret_required`, and did not match C# `System.Text.Json` strictness. Patching more ad-hoc scanners would not justify Strict UTF-8/JSON = PASS.
- Alternatives considered:
  - Keep handwritten parser — rejected (contract holes).
  - RapidJSON — MIT, fast, verbose SAX; heavier integration.
  - yyjson — MIT, C, small; extra C toolchain surface.
  - nlohmann/json 3.12.0 — MIT, header-only, mature, default-reject trailing commas/comments/trailing garbage; SAX can fail-closed on duplicate keys.
- Decision: Vendor official `json.hpp` (SHA-256 `aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63` from downloaded bytes). IPC JSON only. Not a codec. Duplicate keys, unknown envelope fields, non-object payload, and non-boolean `secret_required` fail closed. ResourceGovernor FIFO holes are fixed in the same G2 hotfix (strict head-of-line).
- Consequences: Native parse tests (`lumina-ipc-parse-test`) must run the real parser. G3 still does not start.

## ADR-0017 — G3 official 7z.dll adapter

- Date: 2026-08-29
- Status: accepted
- Context: `7z2602-extra.7z` was pinned as the production DLL source. Its readme states `7za.dll` is a **reduced 7z-only** library and that **`7z.dll` is the main DLL**. Extra contains `7za.dll` / `7zxa.dll` for x86/x64/arm64, not `7z.dll`. Silently substituting `7za.dll` would violate ADR-0002.
- Decision:
  - Production x64 `7z.dll` is extracted from official `7z2602-x64.exe` (NSIS) after SHA-256 `6745fa76dc2ea031596d8678f6f6b99c3c1b435b4164a63485adbbc7b8d82ef0`.
  - Production ARM64 `7z.dll` is extracted from official `7z2602-arm64.exe` after SHA-256 `7c6fde79ed5e11b81c7bb6573b7962d3b6322aa5fce69c33ed19f672b55173ab`.
  - Extraction uses pinned `7zr.exe`; the installer is never executed.
  - Runtime binaries are fetched/staged, never committed.
  - Interface headers are the 26.02 source commit `f9d78aff31a5f2521ae7ddbdc97c4a8855808959`, vendored as a minimal subset under `third_party/7zip-26.02/sdk`. `Common0.h` includes `NewHandler.h`; that header is vendored because MSVC cannot compile the adapter without it. `NewHandler.cpp` is not needed on VS2015+.
  - `lumina-7z-adapter.dll` is a versioned C ABI (v1). Engine loads it from an absolute sibling path with `LoadLibraryExW` + `LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|SYSTEM32`. Adapter loads `7z.dll` the same way.
  - Handler discovery via `GetNumberOfFormats`/`GetHandlerProperty2`. Product-verified formats in G3: **7z** and **ZIP**. Others are `AVAILABLE_BACKEND` only.
  - G3 is Open/List/Test. `IArchiveExtractCallback::GetStream` never creates files. Safe Extract is G4.
  - Passwords: UTF-8 secret pipe → UTF-16 → `SysAllocString` for `ICryptoGetTextPassword`. Lumina wipes owned buffers. BSTR copies inside unmodified `7z.dll` are **not** claimed zeroized.
- Consequences: Extra.7z remains a bench/bootstrap artifact, not the production DLL. ARM64 runtime execution is not claimed on x64 GitHub runners.


