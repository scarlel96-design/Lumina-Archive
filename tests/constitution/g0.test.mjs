import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "bin" || name === "obj" || name === "build" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function read(p) {
  return readFileSync(join(root, p), "utf8");
}

const required = [
  "AGENTS.md",
  "docs/LUMINA_SPEC_v0.2.md",
  "docs/DECISIONS.md",
  "docs/STATUS.md",
  "docs/IPC.md",
  "docs/ipc/protocol.schema.json",
  "security/THREAT_MODEL.md",
  "THIRD_PARTY.md",
  "eng/versions.json",
  "eng/versions.schema.json",
  "eng/g0-windows-audit.ps1",
  "design/tokens.json",
  "LuminaArchive.sln",
  "nuget.config",
  "CMakeLists.txt",
  "CMakePresets.json",
  "apps/win/Lumina.Win.csproj",
  "apps/cli/Lumina.Cli.csproj",
  "src/domain/Lumina.Domain.csproj",
  "src/supervisor/Lumina.Supervisor.csproj",
  "native/engine/src/main.cpp",
  "native/shell/src/explorer_command.cpp",
  "native/7z-adapter/src/adapter_stub.cpp",
  ".github/workflows/constitution.yml",
  ".github/workflows/windows-native.yml",
  "bench/RESULTS.md",
];

test("G0 required files exist", () => {
  const missing = required.filter((p) => !existsSync(join(root, p)));
  assert.deepEqual(missing, []);
});

test("AGENTS.md forbids web replacement and password argv", () => {
  const text = read("AGENTS.md");
  for (const needle of ["Electron", "Tauri", "argv", "7z.dll", "BLOCKED BY ENVIRONMENT"]) {
    assert.ok(text.includes(needle), `missing ${needle}`);
  }
});

test("versions.json pins and pending hashes", () => {
  const lock = JSON.parse(read("eng/versions.json"));
  assert.equal(lock.dependencies.sevenZip.version, "26.02");
  assert.equal(lock.dependencies.minizipNg.version, "4.2.2");
  assert.equal(lock.dependencies.zlibNg.version, "2.3.3");
  assert.equal(lock.dependencies.libarchive.version, "3.8.9");
  assert.equal(lock.toolchains.windowsAppSdk, "2.4.0");
  assert.ok(lock.removedFromV01.includes("libzip"));
  for (const dep of Object.values(lock.dependencies)) {
    assert.ok(dep.sha256, dep.id);
    assert.equal(dep.modified, false);
  }
});

test("WinUI project has no archive codec dependency", () => {
  const csproj = read("apps/win/Lumina.Win.csproj");
  const refs = [...csproj.matchAll(/<PackageReference\s+Include="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    refs.filter((id) => /7z|minizip|zlib|libarchive|isa-l|libdeflate|blake3/i.test(id)),
    [],
  );
  assert.ok(refs.includes("Microsoft.WindowsAppSDK"));
  assert.ok(csproj.includes("2.4.0"));
  assert.ok(csproj.includes("WindowsPackageType>None"));
  assert.equal(/<PackageReference[^>]+Include="[^"]*(vite|electron|tauri|tanstack)/i.test(csproj), false);
  assert.equal(/<(Content|None|ProjectReference)\s+Include=.*package\.json/i.test(csproj), false);
});

test("solution builds C# projects on Release|x64 and excludes CMake", () => {
  const sln = read("LuminaArchive.sln");
  assert.equal(sln.includes("CMakeLists.txt"), false);
  for (const guid of [
    "A1111111-1111-1111-1111-111111111111",
    "A2222222-2222-2222-2222-222222222222",
    "A3333333-3333-3333-3333-333333333333",
    "A4444444-4444-4444-4444-444444444444",
  ]) {
    assert.ok(
      sln.includes(`{${guid}}.Release|x64.Build.0`),
      `missing Build.0 for ${guid}`,
    );
  }
});

test("shell tree has no parser headers or codec links", () => {
  const files = walk(join(root, "native/shell"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const t = readFileSync(f, "utf8");
    assert.equal(/7z\.h|Cpp\/7zip|minizip|mz_zip|archive\.h|libarchive/i.test(t), false, f);
    assert.equal(/target_link_libraries/i.test(t), false, f);
  }
  const src = read("native/shell/src/explorer_command.cpp");
  assert.ok(src.includes("no parser"));
});

test("7zz is not configured as the production path", () => {
  const dirs = ["apps", "src/domain", "src/supervisor", "native"];
  for (const d of dirs) {
    for (const f of walk(join(root, d))) {
      if (!/\.(cs|cpp|hpp|csproj|cmake|txt)$/i.test(f)) continue;
      const t = readFileSync(f, "utf8");
      assert.equal(/7zz(\.exe)?/i.test(t), false, relative(root, f));
    }
  }
});

test("secrets cannot be represented in argv or env in product code", () => {
  const dirs = ["apps", "src/domain", "src/supervisor", "native"];
  const bad = / -pPASSWORD|password=.+argv|argv.+password|GetEnvironmentVariable\(\s*"LUMINA_PASSWORD/i;
  for (const d of dirs) {
    for (const f of walk(join(root, d))) {
      if (!/\.(cs|cpp|hpp)$/i.test(f)) continue;
      const t = readFileSync(f, "utf8");
      assert.equal(bad.test(t), false, relative(root, f));
    }
  }
  const engine = read("native/engine/src/main.cpp");
  assert.ok(engine.includes("never read passwords from argv"));
});

test("web preview is not on the Windows packaging path", () => {
  const sln = read("LuminaArchive.sln");
  assert.equal(/package\.json|vite\.config|src\\routes/i.test(sln), false);
  const win = read("apps/win/Lumina.Win.csproj");
  assert.equal(/Content Include="\.\.\\\.\.\\(package\.json|src\\routes)/i.test(win), false);
  const workflow = read(".github/workflows/windows-native.yml");
  assert.equal(/npm run (dev|build)|vite build/i.test(workflow), false);
});

test("engine G0 does not enable codecs", () => {
  const cmake = read("native/engine/CMakeLists.txt");
  assert.ok(cmake.includes("G0 forbids codec enablement"));
});

test("IPC schema version is 1", () => {
  const schema = JSON.parse(read("docs/ipc/protocol.schema.json"));
  assert.equal(schema.properties.protocol_version.const, 1);
});

test("Windows workflow restores, builds, and audits", () => {
  const wf = read(".github/workflows/windows-native.yml");
  assert.ok(wf.includes("windows-latest"));
  assert.ok(wf.includes("dotnet restore LuminaArchive.sln"));
  assert.ok(wf.includes("cmake --preset windows-x64-release"));
  assert.ok(wf.includes("cmake --preset windows-arm64-release"));
  assert.ok(wf.includes("lumina-engine"));
  assert.ok(wf.includes("lumina-7z-adapter"));
  assert.ok(wf.includes("g0-windows-audit.ps1"));
});

test("STATUS records remaining host blocker honestly", () => {
  const status = read("docs/STATUS.md");
  assert.ok(status.includes("G0"));
  assert.ok(status.includes("windows-latest") || status.includes("BLOCKED BY ENVIRONMENT"));
});
