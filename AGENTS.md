# Lumina Archive — Agent Constitution

This file is the **architecture invariant**. Later prompts must not replace the
native Windows product with a web, Electron, Tauri, React-desktop, or Python GUI
shell. If this sandbox can only host a live preview, that preview is a
**constitution dashboard**, never the archiver.

Source of truth: [`docs/LUMINA_SPEC_v0.2.md`](docs/LUMINA_SPEC_v0.2.md).
Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md).
Status: [`docs/STATUS.md`](docs/STATUS.md).
Pins: [`eng/versions.json`](eng/versions.json).

## Product

Lumina Archive is an original archive manager that competes with Bandizip 7.46
on ZIP throughput, safe extract, job scheduling, and free power features.
7-Zip 26.02 supplies 7z math and format compatibility. Lumina owns Adaptive ZIP,
parallel ZIP extract, Safety Center, and the unified Job Supervisor.

## Frozen stack (Windows v1)

| Layer | Technology | Process |
|---|---|---|
| Lumina.Win | C# / .NET 10.0.11 LTS / WinUI 3 / Windows App SDK 2.4.0 | UI |
| Lumina.Domain | C# | models, routing policy, settings |
| Lumina.Supervisor | C# + Win32 interop | Job Object, IPC, watchdog, budgets |
| lumina-engine.exe | C++20/23 | codecs, Adaptive ZIP, safe extract |
| lumina-preview.exe | C++ or C# | WIC decode, low privilege |
| lumina-shell.dll | C++ IExplorerCommand | activate app only — **no parser** |
| lumina-cli | C# | same Supervisor/IPC contract |

Certified OS: Windows 11. Compatibility: Windows 10 22H2 ESU/LTSC. Do not lower
Windows 11 quality to chase Windows 10 cosmetics.

## Absolute invariants

1. **Do not replace the native stack.** Electron, Tauri, React desktop, Python
   GUI, browser-as-product, or “ship ZIP in WASM so preview works” are forbidden.
   If WinUI/MSVC cannot run here, finish sources and scripts and report
   `native build = BLOCKED BY ENVIRONMENT`. Never call that PASS.
2. **Do not write codecs.** New dependencies are a design change: record
   reason, license, security, and alternatives in `docs/DECISIONS.md` first.
3. **Secrets never travel argv, environment, or general logs.** Production 7-Zip
   uses `7z.dll` callbacks and a dedicated secret IPC pipe.
4. **Codecs/parsers never load in the UI or Explorer process.**
5. **Every archive path is untrusted.** Block writes outside the output root,
   ADS/device paths, reparse/link escape, and archive bombs.
6. **Do not claim performance from intuition.** Only [`bench/RESULTS.md`](bench/RESULTS.md).
7. **Do not start the next phase until the current gate is PASS** (or an
   explicit CONDITIONAL PASS that names the environment blocker).

## Phase order

G0 Constitution → G1 Bench harness → G2 IPC+Supervisor → G3 7z.dll core →
G4 Safe Extract → G5 Adaptive ZIP → G6 WinUI shell → G7 power features →
G8 Explorer/MSIX/update → G9 RC hardening.

Current phase is recorded in `docs/STATUS.md`. **This tree is G1 (bench harness).**
G2 is blocked until G1 is PASS (physical Windows numbers) or an explicit
CONDITIONAL PASS that names the remaining blocker.


## OSS ownership (no overlapping roles)

| Pin | Role |
|---|---|
| 7-Zip 26.02 official unmodified DLL | 7z / RAR-read / generic / fallback |
| minizip-ng 4.2.2 | ZIP container / AES / ZIP64 / raw-entry / edit |
| zlib-ng 2.3.3 | Deflate streaming fast path |
| ISA-L 2.32.1 | optional x64 accelerator |
| libdeflate 1.25 | bench-gated whole-buffer path |
| libarchive 3.8.9 | TAR/cpio/ISO — **not** ZIP hot path |
| zstd 1.5.7, LZ4 1.10.0, XZ 5.8.3, BLAKE3 1.8.7 | codecs / checksum |

libzip is removed. NanaZip/PeaZip are references, not runtime.

## Reporting

Every phase close-out must include: summary, files changed, implementation
notes, build result, test result, regression, issues found/fixed, open risks,
spec compliance, gate verdict (`PASS` / `CONDITIONAL PASS` / `FAIL`).

---

## Grok Build sandbox overlay (preview host only)

This overlay is **not** the product. It exists so the isolated Linux host can
show a constitution dashboard on the platform live preview.

- Listen on `0.0.0.0:8080` via `npm run dev` (never raw `vite`).
- Keep `/workspace/startup.sh` as the revive entrypoint.
- Do not delete `public/__grok/`, `server/`, `scripts/grok-pwa-*`,
  `vite.config.ts` contracts, or `<PreviewHostBridge />`.
- Auth and database stay OFF.
- The dashboard must state that native WinUI/C++ is the source of truth and
  that this web surface cannot compress or extract user archives.
