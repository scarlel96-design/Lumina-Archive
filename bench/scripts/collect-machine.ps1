# Records lab-PC state. Does not disable Defender, indexing, or power protections.
$ErrorActionPreference = "Stop"
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cs = Get-CimInstance Win32_ComputerSystem
$disk = Get-CimInstance Win32_DiskDrive | Select-Object -First 1
$sys = $env:SystemDrive
$vol = Get-Volume -DriveLetter $sys.TrimEnd(':')
$plan = powercfg /getactivescheme
$defender = $null
try {
  $defender = (Get-MpComputerStatus).RealTimeProtectionEnabled
} catch {
  $defender = $null
}
$ac = "AC"
if (Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue) { $ac = "battery-present" }

$logical = [int]$env:NUMBER_OF_PROCESSORS
$thread = [Math]::Min(8, $logical)

$obj = [ordered]@{
  kind = "physical-windows"
  os = $os.Caption
  windowsBuild = $os.BuildNumber
  cpu = $cpu.Name.Trim()
  physicalCores = [int]$cpu.NumberOfCores
  logicalProcessors = $logical
  ramGiB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
  filesystem = $vol.FileSystemType.ToString()
  sourceDrive = $sys
  destinationDrive = $sys
  storage = $disk.Model
  acState = $ac
  powerPlan = ($plan | Out-String).Trim()
  defenderRealtime = [bool]$defender
  arch = $env:PROCESSOR_ARCHITECTURE
  threadBudget = $thread
  uptimeSeconds = [int]((Get-Date) - $os.LastBootUpTime).TotalSeconds
  freeRamGiB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  freeDiskGiB = [math]::Round($vol.SizeRemaining / 1GB, 1)
}
$path = Join-Path $PSScriptRoot "..\machine.local.json"
$obj | ConvertTo-Json | Set-Content -Encoding utf8 $path
Write-Output $path
