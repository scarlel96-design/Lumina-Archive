# STATUS

| Field | Value |
|---|---|
| Spec | v0.2 |
| Phase | **G3 — 7z.dll Adapter (IN PROGRESS)** |
| Updated | 2026-08-29 |
| Product version | 0.0.0-g3 |
| G0 | **PASS** |
| G1 harness | **PASS** |
| **G1 overall** | **PASS** |
| **Physical Windows baseline** | **PASS** |
| **G2** | **PASS** |
| **G3** | **IN PROGRESS** |
| **G4 Development Entry** | **BLOCKED** |
| G2 Development Entry | **READY** (closed) |
| Lumina in G1 | **SKIPPED_NOT_LINKED** |
| G1 circular dependency | **RESOLVED** (ADR-0013) |
| Accepted G1 session | `g1-2026-08-29T10-35-59-881Z` |
| G1 harness commit | `c20b61844907fccd13202a888ff480b22c4bfa69` |
| Machine fingerprint | `fd10fb1bd6fbcd094e8a4b936440bf2456188d4b09a4b91abfa06e0bfcbd3dd4` |
| G1 closure commit | `715bf9baaf38d89cd401a396c59de4bc1ca61c24` |
| G2 freeze | `7e30810d61e2a3b389aa430246e0951a0c6a0ffd` |

G1 remains closed. Do not modify baseline numbers. Do not claim Lumina is faster than Bandizip. Competitive compare is G5.

G3: official unmodified `7z.dll` 26.02 via `lumina-7z-adapter.dll` C ABI. Open/List/Test only. No filesystem extraction. No Adaptive ZIP. This commit does **not** start G4.

G0 native compile on this Linux preview host remains **BLOCKED BY ENVIRONMENT**.
Windows GitHub `windows-latest` is the native evidence.
