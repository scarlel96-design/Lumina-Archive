import test from "node:test";
import assert from "node:assert/strict";
import {
  parse7zip,
  parseNanaZip,
  parseBandizip,
  parseLumina,
  rejectSecretArgv,
} from "./parsers.mjs";

const createOut = `
7-Zip (z) 26.02 (x64) : Copyright (c) 1999-2026 Igor Pavlov : 2026-06-25
 64-bit locale=C.UTF-8 Threads:2 OPEN_MAX:4096, ASM

Files read from disk: 2
Archive size: 8474 bytes (9 KiB)
Everything is Ok
`;

test("parse 7-Zip 26.02 create banner", () => {
  const p = parse7zip(createOut);
  assert.equal(p.version, "26.02");
  assert.equal(p.archive_bytes, 8474);
  assert.equal(p.ok, true);
});

test("parse NanaZip falls back to 7-Zip family", () => {
  const p = parseNanaZip("NanaZip.Core 6.5.1800\nEverything is Ok\n");
  assert.equal(p.family, "nanazip");
  assert.equal(p.version, "6.5.1800");
  assert.equal(p.ok, true);
});

test("parse Bandizip uses exit code", () => {
  const p = parseBandizip("Bandizip 7.46\n", "", 0);
  assert.equal(p.family, "bandizip");
  assert.equal(p.version, "7.46");
  assert.equal(p.ok, true);
});

test("parse Lumina not-linked", () => {
  const p = parseLumina('{"product":"Lumina Archive","version":"0.0.0-g1","engine":"not-linked"}\n', "", 0);
  assert.equal(p.skipped, true);
  assert.equal(p.engine, "not-linked");
  assert.equal(p.skipReason, "SKIPPED_NOT_LINKED");
});

test("reject password argv", () => {
  assert.throws(() => rejectSecretArgv(["7zz", "a", "-psecret", "x.zip"]));
  rejectSecretArgv(["7zz", "a", "-tzip", "-mx=1", "x.zip", "a.txt"]);
});
