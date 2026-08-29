import { platform } from "node:os";

const REQUIRED = [
  "os",
  "windowsBuild",
  "cpu",
  "physicalCores",
  "logicalProcessors",
  "ramGiB",
  "filesystem",
  "sourceDrive",
  "destinationDrive",
  "storage",
  "acState",
  "powerPlan",
  "defenderRealtime",
  "arch",
  "threadBudget",
];

export function rejectGithubAsPhysical(authority) {
  if (authority !== "physical-windows") return;
  if (process.env.GITHUB_ACTIONS === "true") {
    throw new Error("GitHub-hosted runners cannot use authority=physical-windows");
  }
  if (platform() !== "win32") {
    throw new Error("authority=physical-windows requires a Windows host");
  }
}

export function assertPhysicalMachine(machine) {
  const missing = REQUIRED.filter((k) => machine[k] === undefined || machine[k] === null || machine[k] === "");
  if (missing.length) {
    throw new Error(`physical machine metadata incomplete: ${missing.join(", ")}`);
  }
  if (typeof machine.defenderRealtime !== "boolean") {
    throw new Error("defenderRealtime must be recorded as boolean (do not auto-disable Defender)");
  }
  if (!Number.isInteger(machine.threadBudget) || machine.threadBudget < 1) {
    throw new Error("threadBudget must be a positive integer");
  }
}
