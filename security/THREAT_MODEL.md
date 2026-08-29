# Threat model — Lumina Archive

Trust: the user and the OS. **Archives, filenames, extra fields, and Explorer
selection paths are untrusted.**

## Boundaries

| Surface | Trust | Notes |
|---|---|---|
| Archive bytes | untrusted | attacker-controlled parser input |
| Paths inside archives | untrusted | zip-slip, ADS, devices, Unicode collisions |
| Output filesystem | mixed | we create files; reparse points lie |
| UI process | trusted-enough | still must not load codecs |
| lumina-engine.exe | sandboxed worker | parses untrusted bytes |
| lumina-preview.exe | sandboxed worker | decodes untrusted images |
| lumina-shell.dll | Explorer | **no parser**, pass paths to the app |
| Control IPC | local, authenticated | versioned, length-prefixed |
| Secret IPC | local, one-shot | passwords; never logged |
| Update channel | high value | MSIX/Store first; no homemade updater in v1 |
| Network | not required | workers designed with no network |

## Assets

- User file confidentiality and integrity
- Passwords / vault credentials
- Host filesystem outside the chosen output root
- Explorer process stability
- Update trust (no trojaned engine)

## Adversaries

1. Malicious archive sent by chat/email/web (zip-slip, bombs, malformed extra).
2. Crafted filename (device names, ADS, trailing dots, RTLO, NFC/NFD twins).
3. Local process snooping argv/env for passwords.
4. Compromised dependency or update payload.
5. UI hang via huge listing or preview decode.

## Invariants (test these)

- Writes outside the output root = 0.
- MoTW dropped on internet-origin extract = 0.
- Password in argv, env, or info logs = 0.
- Parser loaded into Explorer = 0.
- Worker crash kills the UI = 0.
- Temp leftovers after cancel/kill = 0.

## Mitigations by phase

| Phase | Mitigation |
|---|---|
| G0 | contracts, process split, license isolation |
| G2 | Job Object, heartbeat, secret pipe, journal |
| G3 | 7z.dll in worker, crypto callbacks |
| G4 | path/link/bomb/MoTW preflight + hostile corpus |
| G5 | ZIP glue fuzz (not new codecs) |
| G8 | shell has no codec; signed MSIX |
| G9 | libFuzzer + ASan on path/IPC/encoding glue |

## Non-goals

- Replacing Windows Defender
- Password recovery (deferred)
- AppContainer brokered I/O (High Assurance milestone, not G0–G6)

## G2 threats and mitigations

| Threat | Mitigation | Residual |
|---|---|---|
| Malicious same-user pipe client | Current-user ACL + `GetNamedPipeClientProcessId` vs launched PID | Same-PID spoof requires already-compromised worker |
| Remote named-pipe access | Local pipe, no remote ACE, no network listener | Admin/kernel bypass |
| Oversized frame | 1 MiB cap before allocate | None material |
| Malformed UTF-8/JSON | Strict decode, fail closed | None material |
| Sequence replay/gap | Contiguous seq per direction | Lost frames fail the job |
| Wrong job ID | Envelope `job_id` must match connection | None material |
| Secret leakage | Separate pipe, no argv/env/journal/logs, zero memory | Crash dumps still OS-controlled |
| Worker escape/orphan | Job Object KILL_ON_JOB_CLOSE, active-process 1 | Debugger-created processes outside job |
| Heartbeat stall | Watchdog → Interrupted + job terminate | Clock attack on injected TimeProvider in tests only |
| Journal corruption | Atomic replace, quarantine, never Succeeded | Disk-full during replace |
| Terminal-state race | Single lock, immutable terminal | None material |
| Resource starvation | FIFO leases, oversized fail-fast, cancel waiter | Pathological many waiters |

G2 does not parse archives. Archive-byte threats remain G3/G4.
