# IPC contract (G2)

Production control channel is a **local Windows Named Pipe**. It is not a
WebSocket, not a browser worker, and not a Node child_process.

## Framing

```
uint32le frame_len | utf8 json object
```

- Little-endian payload length, then exactly N UTF-8 JSON bytes.
- Maximum control frame: **1 MiB**.
- `length == 0` is invalid.
- `length > MAX` is invalid. Do not allocate attacker-controlled sizes.
- Short header or short body is `MalformedFrame`.
- UTF-8 is **strict** (C# `UTF8Encoding(false, throwOnInvalidBytes: true)`;
  C++ rejects overlong/surrogate/truncated sequences). Invalid UTF-8 is
  `InvalidUtf8`, never a replacement parse.
- JSON is strict: no comments, no trailing commas, envelope
  `additionalProperties=false`.
- `payload` is **required**. Empty payload is `{}`.

Schema: [`docs/ipc/protocol.schema.json`](ipc/protocol.schema.json).

## Envelope

All six fields are mandatory:

`protocol_version` (exactly `1`), `job_id`, `seq`, `kind` (`command`|`event`),
`type`, `payload`.

Unknown protocol versions fail job startup (`ProtocolVersionUnsupported`)
and close the connection. No heuristic parsing.

## Sequence

`seq` is monotonic and **contiguous per direction**.

- Supervisor commands: 0, 1, 2, …
- Engine events: 0, 1, 2, …

Duplicate, gap, or decrease is `SequenceViolation`. The two directions do
not share a counter.

Acknowledgements (`accepted`, `paused`, `resumed`, `cancelled`) **must**
include `{"command_seq": N}` where `N` is the integer sequence of the
command being acknowledged (`>= 0`). Missing, non-integer, negative, or
mismatched `command_seq` is `EnvelopeInvalid` / `ProtocolBroken` and must
not mutate public `JobState`.

Heartbeat payload requires `uptime_ms` (integer `>= 0`) and `state`
(`"running"` or `"paused"`). Heartbeat continues while cooperatively paused.

`completed` / `failed` are reserved for later codec work. G2 workers do not
emit them; if they appear, extra fields remain constrained and `command_seq`
is optional but type-checked when present.

Do not use timestamps as correlation IDs.

## Direction

Supervisor → engine commands: `start`, `pause`, `resume`, `cancel`, `shutdown`.

Engine → supervisor events: `accepted`, `progress`, `heartbeat`, `paused`,
`resumed`, `completed`, `failed`, `cancelled`, `archive_info`, `entry_batch`.

Wrong direction is `EnvelopeInvalid`. Pause is **not** observable until the
worker emits `paused`. Resume is not Running until `resumed`.

## Pipe names

`LuminaArchive.v1.{job-guid}.control`
`LuminaArchive.v1.{job-guid}.secret`

Windows path: `\\.\pipe\` + name.

Names never include archive filename, destination, username, password, or
user-entered text. Job GUID is not a secret.

## Security

- Local Named Pipes only. Current-user SID ACL (`ReadWrite` + create instance).
  Not Everyone-writable. Remote clients are not granted access.
- After connect, Supervisor requires
  `GetNamedPipeClientProcessId == launched worker PID` on **both** pipes.
  Mismatch: disconnect, fail job, terminate contained worker
  (`PipePeerMismatch`).

## Launch order

Create pipe servers → `CreateProcessW` **CREATE_SUSPENDED** → Job Object with
`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` (+ active process limit 1) →
`AssignProcessToJobObject` and verify → `ResumeThread` → wait connect + PID
check. Never `Process.Start` then assign.

Pause is cooperative IPC. `SuspendThread` / `NtSuspendProcess` are forbidden.

## Secret pipe

Binary one-shot frame: `uint32le length | raw bytes`. Max **64 KiB**.

One connection, one message, then close. No JSON. No retry loop. Wrong PID,
zero length when required, oversize, partial, or second frame:
`SecretFrameInvalid`.

Secrets never enter argv, environment, control JSON, journal, logs, or
exception messages. C# uses `SecretBuffer` + `CryptographicOperations.ZeroMemory`.
C++ uses `SecureZeroMemory` after G2 consumption. G3 will pass bytes into
7z.dll callbacks; G2 does not.

## Heartbeat / watchdog

Engine emits `heartbeat` about every 1s while alive, **including while
cooperatively paused**. Stale after 5s: graceful cancel/shutdown, 2s grace,
then `TerminateJobObject`. Primary state is `Interrupted` with
`HeartbeatTimeout`. `forced_termination=true`. A TerminateJobObject Win32
failure is recorded as `termination_error_code` and does **not** replace
the primary reason. Dispose uses non-throwing TryTerminate; KILL_ON_JOB_CLOSE
is the containment backstop.

Unexpected process exit without a prior terminal event is `Interrupted`,
not `Failed`. A normal exit **after** `completed`/`failed`/`cancelled` must
not rewrite the terminal state.

## Terminal races

Terminal states: Succeeded, Failed, Cancelled, Interrupted. Immutable.

`completed` committed first wins over a late cancel. Cancel is idempotent:
`Accepted` / `AlreadyRequested` / `AlreadyTerminal` / `NotFound`.

## Journal

Atomic snapshot JSON (temp + `Flush(true)` + replace). No secrets. Restart:
Running/Paused → Interrupted. Other states preserved. Corrupt/truncated
JSON is quarantined and `JournalCorrupt` — never Succeeded.

## Resource grants

`start.payload.grant` carries **granted** CPU/RAM/I/O/preview limits from
`ResourceGovernor`, not the caller's unbounded request.

## Errors

`ProtocolVersionUnsupported`, `FrameTooLarge`, `MalformedFrame`,
`InvalidUtf8`, `InvalidJson`, `EnvelopeInvalid`, `SequenceViolation`,
`JobIdMismatch`, `PipePeerMismatch`, `SecretFrameInvalid`,
`WorkerLaunchFailed`, `WorkerExitedUnexpectedly`, `HeartbeatTimeout`,
`JournalCorrupt`, `ResourceRequestTooLarge`.

Logs may include job ID, type, seq, PID, state, failure code. They must not
dump secrets or wholesale control JSON.

## G3 start / archive events

`start.payload` may include:

- `g2_mode` — `"protocol-self-test"` (G2 regression; no archive I/O)
- `operation` — `"test"` for G3 integrity test
- `source_path` — archive path (operational data, required when operation=test)
- `format_hint` — optional `"7z"` / `"zip"`
- existing `job_kind`, `secret_required`, `grant`

No password field. Unknown fields fail closed.

G3 events (still protocol v1):

- `archive_info` — `{format, item_count, physical_size, solid, encrypted}` (nulls when unknown)
- `entry_batch` — `{batch_index, first_entry_index, entries:[...]}` serialized size ≤ 512 KiB
- `progress` — honest callback bytes/phase
- `completed` / `failed` — `{code, items_tested?}` ; `PasswordRequired` / `WrongPassword` / `NotArchive` / `CrcError` / ...

Listing streams; it must not be a single giant frame. Paths inside entries are untrusted metadata strings, not filesystem targets.

