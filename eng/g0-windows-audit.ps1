# G0 Windows boundary audit. Fails the job; does not weaken product invariants.
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Assert-True($cond, $msg) {
  if (-not $cond) { throw $msg }
}

$prodGlobs = @(
  "apps/win/**/*.csproj",
  "apps/cli/**/*.csproj",
  "src/domain/**/*.csproj",
  "src/supervisor/**/*.csproj",
  "apps/win/**/*.cs",
  "apps/cli/**/*.cs",
  "src/domain/**/*.cs",
  "src/supervisor/**/*.cs",
  "native/**/*.cpp",
  "native/**/*.hpp",
  "native/**/CMakeLists.txt"
)

$prodFiles = Get-ChildItem -Recurse -File apps, src/domain, src/supervisor, native |
  Where-Object { $_.FullName -notmatch "\\obj\\|\\bin\\|\\build\\" }

# 1. No archive parsers in shell
$shell = Get-ChildItem native/shell -Recurse -File
foreach ($f in $shell) {
  $t = Get-Content -Raw $f.FullName
  Assert-True ($t -notmatch '(?i)7z\.h|Cpp/7zip|minizip|mz_zip|archive\.h|libarchive') `
    "shell parser include: $($f.FullName)"
  Assert-True ($t -notmatch '(?i)target_link_libraries\([^\)]*(7z|minizip|zip|archive)') `
    "shell link: $($f.FullName)"
}

# 2. UI project has no codec PackageReference / native codec proj
$win = Get-Content -Raw "apps/win/Lumina.Win.csproj"
Assert-True ($win -notmatch '(?i)<PackageReference\s+Include="[^"]*(7z|minizip|zlib|libarchive|isa-l|libdeflate|blake3)') `
  "WinUI codec PackageReference"
Assert-True ($win -match 'Microsoft.WindowsAppSDK') "WinUI missing WASDK"
Assert-True ($win -match 'WindowsPackageType>None') "G0 WinUI must stay unpackaged"

# 3. 7zz is not the production path
foreach ($f in $prodFiles) {
  $t = Get-Content -Raw $f.FullName
  Assert-True ($t -notmatch '(?i)7zz(\.exe)?') "7zz production path: $($f.Name)"
}

# 4. Secrets cannot be represented in argv
foreach ($f in $prodFiles) {
  $t = Get-Content -Raw $f.FullName
  Assert-True ($t -notmatch '(?i)-pPASSWORD|password=.+argv|argv.+password|Environment\.GetEnvironmentVariable\(\s*"?LUMINA_PASSWORD') `
    "secret argv/env: $($f.Name)"
}

# 5. Web preview is not in Windows packaging
Assert-True ($win -notmatch '(?i)<(Content|None|ProjectReference)\s+Include="[^"]*(package\.json|vite\.config|electron|tauri)') `
  "web toolchain leaked into WinUI csproj"
$sln = Get-Content -Raw "LuminaArchive.sln"
Assert-True ($sln -notmatch 'package\.json|vite\.config') "web files in sln"
Assert-True ($sln -notmatch 'CMakeLists.txt') "CMake must not be inside the .NET sln"

# 6. Codec enablement stays off
$engineCmake = Get-Content -Raw "native/engine/CMakeLists.txt"
Assert-True ($engineCmake -match 'G0 forbids codec enablement') "codec gate missing"

Write-Host "G0 Windows audit PASS"
