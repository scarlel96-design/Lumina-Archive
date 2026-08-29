# G3 archive fixtures

Tiny deterministic archives for Open/List/Test. Not a performance corpus.
Fixture passwords are test data, not user credentials. The production secret
pipe is still used at runtime; these files were generated once and committed.

| File | Format | Encrypted | Items (approx) | Integrity | Purpose |
|---|---|---|---|---|---|
| `plain.7z` | 7z | no | 2 | OK | list/test |
| `plain.zip` | ZIP | no | 2 | OK | list/test |
| `unicode.7z` | 7z | no | 1 | OK | Hangul name metadata |
| `unicode.zip` | ZIP | no | 1 | OK | Hangul name metadata |
| `empty.zip` | ZIP | no | 0 | OK | empty archive |
| `empty.7z` / `dirs-only.7z` | 7z | no | dir | OK | directory-only |
| `header-encrypted.7z` | 7z | header+data AES | 1 | OK with fixture password | open-path password callback |
| `data-encrypted.7z` | 7z | data AES | 1 | OK with fixture password | extract/test password |
| `malicious-names.zip` | ZIP | no | several | OK | untrusted metadata listed, never written |
| `many-entries.zip` | ZIP | no | 2500 | OK | batching / cancel |
| `truncated.7z` | 7z | n/a | n/a | fail | truncated |
| `truncated.zip` | ZIP | n/a | n/a | fail | truncated |
| `crc-corrupt.zip` | ZIP | n/a | n/a | fail | mutated bytes |
| `random.bin` | none | n/a | n/a | fail | not an archive |

100k-entry stress is optional and is not a mandatory CI fixture. `many-entries.zip` (2500) is the CI list-stream fixture.

Encrypted 7z files use a non-production fixture password known to the G3 test suite. Do not print it in assertion messages.
