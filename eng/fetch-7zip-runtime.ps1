# Fetch official unmodified 7z.dll 26.02 from the Windows installer artifact.
# Extra package 7z2602-extra.7z does NOT contain 7z.dll (only reduced 7za.dll).
param(
  [ValidateSet("x64", "arm64")][string]$Arch = "x64",
  [string]$Dest = ""
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
$pins = Get-Content -Raw "eng/vendor-pins.json" | ConvertFrom-Json
$id = if ($Arch -eq "arm64") { "sevenZipWinArm64" } else { "sevenZipWinX64" }
$art = $pins.artifacts | Where-Object { $_.id -eq $id } | Select-Object -First 1
$boot = $pins.artifacts | Where-Object { $_.id -eq "sevenZip7zr" } | Select-Object -First 1
if (-not $art) { throw "missing pin $id" }
$cache = Join-Path $root "vendor/cache"
New-Item -ItemType Directory -Force $cache | Out-Null
if (-not $Dest) {
  $Dest = Join-Path $root "runtime/7zip/$Arch"
}
New-Item -ItemType Directory -Force $Dest | Out-Null

function Get-Sha256([string]$path) {
  return (Get-FileHash -Algorithm SHA256 $path).Hash.ToLowerInvariant()
}

function Fetch([string]$url, [string]$out, [string]$expect, [int]$bytes) {
  if (-not (Test-Path $out)) {
    Write-Host "GET $url"
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
  }
  $len = (Get-Item $out).Length
  if ($bytes -gt 0 -and $len -ne $bytes) { throw "size mismatch $($out): $len != $bytes" }
  $h = Get-Sha256 $out
  if ($h -ne $expect.ToLowerInvariant()) { throw "sha256 mismatch $($out): $h" }
  Write-Host "verified $out $h"
}

$installer = Join-Path $cache $art.artifact
$sevenzr = Join-Path $cache $boot.artifact
Fetch $art.url $installer $art.sha256 ([int]$art.bytes)
Fetch $boot.url $sevenzr $boot.sha256 ([int]$boot.bytes)

$stage = Join-Path $cache ("extract-" + $Arch)
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
& $sevenzr x -y ("-o" + $stage) $installer "7z.dll" "License.txt" | Out-Host
$dll = Join-Path $stage "7z.dll"
if (-not (Test-Path $dll)) { throw "7z.dll missing after extract" }
Copy-Item $dll (Join-Path $Dest "7z.dll") -Force
if (Test-Path (Join-Path $stage "License.txt")) {
  Copy-Item (Join-Path $stage "License.txt") (Join-Path $Dest "License.txt") -Force
}
Write-Host "staged $(Join-Path $Dest '7z.dll')"
