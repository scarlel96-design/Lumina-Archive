# Third-party components

Runtime dependencies are pinned in [`eng/versions.json`](eng/versions.json).
Hashes marked `PENDING_OFFICIAL_ARTIFACT` must be replaced with official
SHA-256 before any release artifact is published.

This product does **not** vendor Bandizip, WinRAR, or their resources.

| Component | Version | License | Role | Modified | Review |
|---|---|---|---|---|---|
| 7-Zip | 26.02 | LGPL-2.1-or-later | unmodified `7z.dll` | no | required notice + source link at ship |
| minizip-ng | 4.2.2 | Zlib | ZIP container | no | G5 |
| zlib-ng | 2.3.3 | Zlib | Deflate fast path | no | G5 |
| Intel ISA-L | 2.32.1 | BSD-3-Clause | optional x64 accel | no | G5, x64 only |
| libdeflate | 1.25 | MIT | optional whole-buffer | no | bench-gated |
| libarchive | 3.8.9 | BSD-2-Clause | TAR/cpio/ISO | no | G3+ |
| zstd | 1.5.7 | BSD-3-Clause OR GPL-2.0-only | codec | no | prefer BSD terms in binaries |
| LZ4 | 1.10.0 | BSD-2-Clause | codec | no | ok |
| XZ Utils | 5.8.3 | 0BSD / LGPL / GPL mix | xz/lzma | no | confirm binary license set |
| BLAKE3 | 1.8.7 | CC0-1.0 OR Apache-2.0 | checksum | no | ok |
| .NET 10 / WinUI 3 / WASDK 2.4.0 | pin in versions.json | Microsoft | UI | n/a | ok |

## 7-Zip LGPL notes

Official FAQ: using the DLL/EXE requires LGPL notice and a source link.
Copying 7-Zip sources into a wrapper DLL makes **that wrapper** LGPL/GPL.
Therefore `native/7z-adapter` is a separate module. The unmodified `7z.dll`
is redistributed as a distinct binary.

## Explicitly not included

| Name | Why |
|---|---|
| libzip | superseded by minizip-ng (ADR-0003) |
| NanaZip / PeaZip | reference only |
| UnEGG / EGG | commercial-use limits; no promise |
| RAR encoder | proprietary |

## Preview dashboard (this sandbox only)

The constitution dashboard may use the Grok App Builder web toolchain
(React, TanStack, Tailwind). That toolchain is **not** part of the Windows
product and must not be copied into `apps/win`.
