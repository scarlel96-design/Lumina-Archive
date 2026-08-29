# Lumina Archive — Specification v0.2

Grok Build web production flow. Windows 11 certified. Windows 10 compatibility.
Later macOS / Linux. This document is source-of-truth for product architecture.

## North star

Not “7-Zip with a prettier skin”. 7-Zip owns 7z math and broad format read.
Lumina owns Adaptive ZIP, parallel ZIP extract, Safety Center, unified Job
Queue, and free power features. Competitive baseline: **Bandizip 7.46**.

No ads. No telemetry. No edition locks.

## Stack

See `AGENTS.md` and `eng/versions.json`.

Process model: UI process never loads codecs. One engine worker per job, inside
a Job Object with kill-on-close. Supervisor owns global CPU/RAM/I/O/preview
budgets so N jobs cannot each grab “all logical cores”.

## Adaptive ZIP

Create routing:

| Condition | Path |
|---|---|
| Fast + general files | zlib-ng streaming |
| x64 + Fast + ISA-L eligible | ISA-L, else zlib-ng |
| small/medium + RAM budget | libdeflate if bench proves it |
| low compressibility | ZIP STORE (sample / early-abort) |
| AES / split / special | minizip-ng capability path |
| accelerator failure | zlib-ng or 7z.dll fallback — do not hide the error |

Parallel create is **not** multi-writer into one ZIP. Entries compress in a
bounded pool, then commit in defined order via minizip-ng raw-entry. Over RAM
budget → spool or lower concurrency.

Parallel extract eligibility: ZIP, STORE or DEFLATE, local SSD/NVMe preferred,
not encrypted/split/damaged CD, no symlink/hardlink, path preflight complete.
Concurrency follows CPU **and** destination queue depth.

## Safety Center

Preflight before any write:

- Normalize paths. Block absolute/UNC/device namespace, drive-relative,
  `..`, ADS colon, reserved device names, trailing dot/space.
- Detect Unicode/case collisions. Never auto-overwrite on collision.
- Do not restore symlink/hardlink by default. If enabled, target must stay
  inside output root.
- Reparse points: `FILE_FLAG_OPEN_REPARSE_POINT` + final path recheck.
- Hard/soft ceilings on entry count, declared size, ratio, **runtime bytes**.
- Preserve Mark-of-the-Web on extracted files when the archive had it.

Worker: restricted token, Job Object, DEP/ASLR/CFG/CET where available.
Engine/preview assume no network. Shell DLL never loads a parser.

No in-house antivirus. Optional AMSI. Scan failure is Unknown, never Safe.

## IPC

Versioned Named Pipe. Control: length-prefixed UTF-8 JSON
(`protocol_version`, `job_id`, `seq`, `command|event`, `payload`).
Secret pipe: one-shot, never copied to argv/env/logs.
Heartbeat → graceful cancel → kill tree.
Progress: entries, bytes, rate, redacted current entry, phase.
Cancel is idempotent and cannot overwrite a completed job.
Journal classifies interrupted work after restart.

## Transactional I/O

| Job | Policy |
|---|---|
| New archive | temp beside dest → fsync → test → ReplaceFile |
| Archive edit | rewrite new archive, never in-place |
| Extract to new folder | staging on same volume, rename if possible |
| Extract into existing folder | journal + created/replaced list + best-effort rollback |
| Disk full | estimate + runtime ENOSPC stop. Never claim exact size. |

## Formats

Create P0: ZIP, 7z, TAR, TAR.GZ, TAR.XZ, TAR.ZST.
Create P1: ZIPX (explicit), single-stream GZ/XZ/ZST, split ZIP/7z.
Never: RAR create, SFX, ACE.

Extract: only formats with a test corpus are “Supported”. Others Experimental.
ALZ: possible P1 plugin after license audit. EGG: not promised.

Legacy names: UTF-8 bit / Info-ZIP Unicode extra first, then user override,
then scored CP949/932/936/950. Low confidence → chip in UI, no silent guess
on extract.

## Features

P0: Smart Extract, Job Queue, Parallel ZIP Extract, Adaptive ZIP Create,
Archive Test, Safety Center, Explorer commands, Batch ops, AES passwords.

P1: Checksum (SHA-256 + BLAKE3), Fast Drag-out, Preview, Password Vault,
ZIP Repair, Archive Edit, Encoding Resolver.

P2: Reproducible mode. Password recovery: deferred.

## UI (Windows v1)

Custom titlebar, NavigationView, breadcrumb, virtualized list, optional
preview. Home is recents + drop zone, not a dashboard wall.
Command surface: Extract / Compress / Test / Checksum. Advanced in overflow.
Job Center: compact footer + full queue.
Safety: red only for warnings. No fake “secure” badges.
Transparency: System / Tinted / Solid. Accessibility settings win.
10k–100k entries: virtualization required. First meaningful paint P95 1.5s.

## Bench gates

Warm-up 1 + ≥5 runs, median and p95. Thread budget fixed. Same PC/SSD/power/
Defender state vs 7-Zip 26.02, NanaZip 6.5.1800, Bandizip 7.46.

**G1** records that external baseline only. Lumina is `SKIPPED_NOT_LINKED`.
**G5** is the Lumina-vs-Bandizip competitive gate on the same harness.
See `docs/BENCHMARKING.md`. Do not require Lumina I/O to close G1.

Marketing “faster than Bandizip” additionally requires ZIP create geometric
mean ≥ 1.05× and eligible parallel extract geometric mean ≥ 1.00× across the
fixed corpus — no cherry-picks. G1 does not authorize that sentence.


## License

7-Zip DLL: LGPL notice + source link. Any 7-Zip-derived wrapper is a separate
LGPL module (`native/7z-adapter`). Product code stays under the chosen license
where dependencies allow. SBOM + THIRD_PARTY on every release.

## Phases

G0 Constitution (this tree) → G1 Bench → G2 IPC → G3 7z.dll → G4 Safe Extract
→ G5 Adaptive ZIP → G6 WinUI → G7 power features → G8 packaging → G9 RC.
