# 7-Zip 26.02 minimal SDK headers

Upstream: https://github.com/ip7z/7zip/releases/tag/26.02  
Source tarball: `7z2602-src.tar.xz`  
Commit: `f9d78aff31a5f2521ae7ddbdc97c4a8855808959`  
License: LGPL-2.1-or-later (see `LICENSE.txt`)

Vendored **headers only** — no codecs, no unRAR, no UI, no File Manager.
`Common0.h` includes `NewHandler.h`; that header is required for MSVC.

| Upstream path | Local path |
|---|---|
| `C/Compiler.h` | `sdk/C/Compiler.h` |
| `C/7zTypes.h` | `sdk/C/7zTypes.h` |
| `C/7zWindows.h` | `sdk/C/7zWindows.h` |
| `CPP/Common/Common0.h` | `sdk/CPP/Common/Common0.h` |
| `CPP/Common/NewHandler.h` | `sdk/CPP/Common/NewHandler.h` |
| `CPP/Common/MyWindows.h` | `sdk/CPP/Common/MyWindows.h` |
| `CPP/Common/MyUnknown.h` | `sdk/CPP/Common/MyUnknown.h` |
| `CPP/Common/MyTypes.h` | `sdk/CPP/Common/MyTypes.h` |
| `CPP/Common/MyGuidDef.h` | `sdk/CPP/Common/MyGuidDef.h` |
| `CPP/7zip/IDecl.h` | `sdk/CPP/7zip/IDecl.h` |
| `CPP/7zip/IProgress.h` | `sdk/CPP/7zip/IProgress.h` |
| `CPP/7zip/IStream.h` | `sdk/CPP/7zip/IStream.h` |
| `CPP/7zip/IPassword.h` | `sdk/CPP/7zip/IPassword.h` |
| `CPP/7zip/PropID.h` | `sdk/CPP/7zip/PropID.h` |
| `CPP/7zip/Archive/IArchive.h` | `sdk/CPP/7zip/Archive/IArchive.h` |

`native/7z-adapter` consumes these interfaces and dynamically loads unmodified `7z.dll`.
`NewHandler.cpp` is **not** vendored: VS2015+ (`_MSC_VER >= 1900`) does not define
`Z7_REDEFINE_OPERATOR_NEW`, so the header is include-complete without the .cpp.
