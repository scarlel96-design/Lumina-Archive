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
    launcher_ok: false,
    child_started: false,
    affinity_applied: false,
    affinity_requested: false,
    wall_ms: null,
    cpu_ms: null,
    cpu_user_ms: null,
    cpu_kernel_ms: null,
    peak_wss_bytes: null,
    peak_private_bytes: null,
    private_usage_bytes_at_exit: null,
    read_ops: null,
    write_ops: null,
    read_bytes: null,
    write_bytes: null,
    exitCode: null,
    affinityMask: null,
    helper_error: reason || null,
    helper_error_code: null,
    telemetryErrors: reason ? [{ api: "spawn", win32Error: 0 }] : [],
    unsupportedReason: reason,
  };
}

export function infrastructureOk(tel, { requireAffinity } = {}) {
  if (!tel || tel.launcher_ok !== true) return false;
  if (tel.wall_ms == null) return false;
  if (tel.exitCode == null) return false;
  if (requireAffinity && tel.affinity_applied !== true) return false;
  return true;
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
  if (opts.authoritative) {
    if (process.platform !== "win32") {
      const tel = emptyTelemetry("authoritative spawn requires win32 helper");
      return { exitCode: 160, stdout: "", stderr: tel.helper_error, wall_ms: null, argv: [command, ...argv], telemetry: tel, helperFailed: true };
    }
    if (!helper) {
      const tel = emptyTelemetry("lumina-bench-run.exe missing");
      return { exitCode: 160, stdout: "", stderr: tel.helper_error, wall_ms: null, argv: [command, ...argv], telemetry: tel, helperFailed: true };
    }
    const run = await spawnViaHelper(helper, command, argv, cwd, opts);
    const ok = infrastructureOk(run.telemetry, { requireAffinity: opts.requireAffinity !== false });
    return { ...run, helperFailed: !ok };
  }
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
      const wall = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({
        exitCode: code ?? 127,
        stdout,
        stderr,
        wall_ms: wall,
        argv: [command, ...argv],
        telemetry: {
          ...emptyTelemetry("lumina-bench-run.exe not used (plain spawn)"),
          wall_ms: wall,
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
    telemetry = { ...emptyTelemetry(null), ...JSON.parse(await readFile(telPath, "utf8")) };
    await rm(telPath, { force: true });
  } catch {
    telemetry.helper_error = "telemetry file missing";
    telemetry.launcher_ok = false;
  }
  const helperFailed = telemetry.launcher_ok !== true;
  return {
    ...plain,
    wall_ms: telemetry.wall_ms,
    telemetry,
    argv: [command, ...argv],
    helper,
    helperFailed,
    childExitCode: helperFailed ? null : telemetry.exitCode,
    helperExitCode: plain.exitCode,
  };
}
