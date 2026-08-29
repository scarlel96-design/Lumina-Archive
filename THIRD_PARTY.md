# Third-party components

Runtime dependencies are pinned in [`eng/versions.json`](eng/versions.json)
and [`eng/vendor-pins.json`](eng/vendor-pins.json). G1 filled SHA-256 from
official downloaded bytes on 2026-08-29. Do not invent hashes.



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
| nlohmann/json | 3.12.0 | MIT | native IPC JSON only | no | G2; not a codec |
| .NET 10 / WinUI 3 / WASDK 2.4.0 | pin in versions.json | Microsoft | UI | n/a | ok |

## 7-Zip LGPL notes

Lumina uses the official unmodified **7z.dll** from 7-Zip 26.02
(https://www.7-zip.org/ and https://github.com/ip7z/7zip/releases/tag/26.02,
commit `f9d78aff31a5f2521ae7ddbdc97c4a8855808959`).

Production x64 DLL is extracted from `7z2602-x64.exe` (not executed).
Production ARM64 DLL is extracted from `7z2602-arm64.exe` (not executed).
`7z2602-extra.7z` is **not** the production DLL source (`7za.dll` is reduced).

Redistribution requires the 7-Zip license notice and a source offer.
Full upstream license text: [`third_party/7zip-26.02/LICENSE.txt`](third_party/7zip-26.02/LICENSE.txt).

Copying 7-Zip interface headers into `native/7z-adapter` keeps **that
adapter** on an LGPL-compatible boundary as a separate DLL
(`lumina-7z-adapter.dll`). Engine talks to it through a C ABI. UI and
Explorer never load the adapter or `7z.dll`.


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
