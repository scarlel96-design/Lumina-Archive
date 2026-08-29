import { spawn } from "node:child_process";
import { access, constants, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { ROOT } from "./common.mjs";
import { rejectSecretArgv } from "./parsers.mjs";
import { findCached } from "./measure-resolve.mjs";

export function emptyTelemetry(reason) {
  return {
    wall_ms: null,
    cpu_ms: null,
    cpu_user_ms: null,
    cpu_kernel_ms: null,
    peak_wss_bytes: null,
    peak_private_bytes: null,
    read_ops: null,
    write_ops: null,
    read_bytes: null,
    write_bytes: null,
    exitCode: null,
    affinityMask: null,
    unsupportedReason: reason,
  };
}

export async function resolveBenchRunner() {
  const env = process.env.LUMINA_BENCH_RUN;
  if (env) return env;
  const named = await findCached(["lumina-bench-run.exe", "lumina-bench-run"]);
  if (named) return named;
  const guesses = [
    join(ROOT, "build/win-x64-release/native/bench-run/Release/lumina-bench-run.exe"),
    join(ROOT, "build/win-x64-release/Release/lumina-bench-run.exe"),
  ];
  for (const g of guesses) {
    try {
      await access(g, constants.F_OK);
      return g;
    } catch {
      /* skip */
    }
  }
  return null;
}

export async function spawnTimed(command, argv, cwd, opts = {}) {
  rejectSecretArgv([command, ...argv]);
  const helper = opts.helper || (await resolveBenchRunner());
  if (helper && process.platform === "win32") {
    return spawnViaHelper(helper, command, argv, cwd, opts);
  }
  return spawnPlain(command, argv, cwd);
}

function spawnPlain(command, argv, cwd) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(command, argv, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    const done = (code, extra = {}) => {
      resolve({
        exitCode: code ?? 127,
        stdout,
        stderr,
        wall_ms: Number(process.hrtime.bigint() - started) / 1e6,
        argv: [command, ...argv],
        telemetry: {
          ...emptyTelemetry("lumina-bench-run.exe not used (plain spawn)"),
          wall_ms: Number(process.hrtime.bigint() - started) / 1e6,
          exitCode: code ?? 127,
        },
        ...extra,
      });
    };
    child.on("error", (err) => done(127, { stderr: stderr + err.message }));
    child.on("close", (code) => done(code));
  });
}

async function spawnViaHelper(helper, command, argv, cwd, opts) {
  const telPath = join(tmpdir(), `lumina-bench-${randomBytes(8).toString("hex")}.json`);
  const helperArgv = [
    `--telemetry=${telPath}`,
    `--cwd=${cwd || ""}`,
    `--affinity-mask=${opts.affinityMask || "0"}`,
    "--",
    command,
    ...argv,
  ];
  const plain = await spawnPlain(helper, helperArgv, cwd);
  let telemetry = emptyTelemetry("helper ran but telemetry file missing");
  try {
    telemetry = JSON.parse(await readFile(telPath, "utf8"));
    await rm(telPath, { force: true });
  } catch {
    /* keep reason */
  }
  return {
    ...plain,
    wall_ms: telemetry.wall_ms ?? plain.wall_ms,
    telemetry,
    argv: [command, ...argv],
    helper,
  };
}
