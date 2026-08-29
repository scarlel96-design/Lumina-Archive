# IPC contract (G2 lands the implementation)

Production control channel: local Named Pipe, length-prefixed UTF-8 JSON.
Schema file: [`docs/ipc/protocol.schema.json`](ipc/protocol.schema.json).

```
uint32le frame_len | utf8 json object
```

Required fields: `protocol_version` (1), `job_id`, `seq`, `kind` (`command` or
`event`), `type`, `payload`.

Commands (supervisor → engine): `start`, `pause`, `resume`, `cancel`,
`shutdown`.

Events (engine → supervisor): `accepted`, `progress`, `heartbeat`,
`completed`, `failed`, `cancelled`.

Secret pipe: separate name `{job_id}.secret`, one message, then close.
Never echo secrets on the control pipe.

7zz CLI is not this contract. It is a no-secret bench fallback only.
