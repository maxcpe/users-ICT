<#
  deploy ระบบจัดการผู้ใช้ (spec 11.1) — รันหลัง `npm run build` ที่โฟลเดอร์โปรเจกต์
  GitHub Actions เรียกให้อัตโนมัติ หรือรันเองบนเซิร์ฟเวอร์: .\deploy\deploy.ps1

  โครงสร้างบนเซิร์ฟเวอร์:
    C:\Web\users\.env           ค่าจริง (สร้างเองครั้งเดียว ไม่อยู่ใน git)
    C:\Web\users\releases\...   แต่ละเวอร์ชัน เก็บ 5 ตัวล่าสุด
    C:\Web\users\current        junction ชี้เวอร์ชันที่ใช้อยู่ (NSSM รัน server.js จากที่นี่)
    C:\Web\users\logs           log ของ service

  ถ้าเวอร์ชันใหม่เปิดไม่ขึ้น สคริปต์ย้อนกลับไปเวอร์ชันเดิมให้เอง
#>
param(
  [string]$AppDir = 'C:\Web\users',
  [string]$ServiceName = 'users',
  [int]$Port = 3006,
  [string]$BasePath = '/users',
  [string]$Source = (Split-Path -Parent $PSScriptRoot),
  [string]$Sha = '',
  [int]$Keep = 5
)

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "==> $msg" }

function Copy-Tree($from, $to) {
  # /XJ: ไม่ตาม junction (สร้างใหม่ทีหลัง) · robocopy: exit code 0-7 = สำเร็จ, 8 ขึ้นไป = ผิดพลาด
  & robocopy $from $to /E /XJ /NFL /NDL /NJH /NJS /NP /R:2 /W:2 /XF .env | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "คัดลอก $from ไม่สำเร็จ (robocopy $LASTEXITCODE)" }
  $global:LASTEXITCODE = 0
}

function Remove-Junction($path) {
  # rmdir ลบเฉพาะ junction ไม่ลบไฟล์ปลายทาง
  if (Test-Path -LiteralPath $path) { cmd /c rmdir "$path" | Out-Null }
}

function Test-App {
  # รอให้หน้า login ตอบ (ไม่ใช่ 5xx) ไม่เกิน 60 วินาที
  $url = "http://127.0.0.1:$Port$BasePath/login"
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
      $req = [System.Net.HttpWebRequest]::Create($url)
      $req.AllowAutoRedirect = $false
      $req.Timeout = 5000
      $res = $req.GetResponse()
      $code = [int]$res.StatusCode
      $res.Close()
    } catch [System.Net.WebException] {
      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode } else { $code = 0 }
    }
    if ($code -ge 200 -and $code -lt 500) { return $true }
  }
  return $false
}

# ---------- ตรวจก่อน deploy ----------
$standalone = Join-Path $Source '.next\standalone'
if (-not (Test-Path (Join-Path $standalone 'server.js'))) { throw "ไม่พบ $standalone\server.js — รัน npm run build ก่อน" }

$envFile = Join-Path $AppDir '.env'
if (-not (Test-Path $envFile)) { throw "ไม่พบ $envFile — สร้างจาก .env.example ก่อน (ดู deploy\README.md)" }
# ตัวแปรสำหรับเครื่องพัฒนาทำให้แอปไม่ยอมเริ่มใน production (spec 11.5) ตรวจชื่ออย่างเดียว ไม่แสดงค่า
$devFlags = Select-String -Path $envFile -Pattern '^\s*(USER_DB_READONLY|ALLOW_PRODUCTION_WRITES)\s*=\s*\S' -List
if ($devFlags) { throw "$envFile มี USER_DB_READONLY หรือ ALLOW_PRODUCTION_WRITES ซึ่งใช้ได้เฉพาะเครื่องพัฒนา ลบออกก่อน" }
foreach ($name in 'DATABASE_URL', 'AUTH_SECRET', 'AUTH_URL', 'AUTH_MICROSOFT_ENTRA_ID_ID', 'AUTH_MICROSOFT_ENTRA_ID_SECRET', 'AUTH_MICROSOFT_ENTRA_ID_ISSUER') {
  if (-not (Select-String -Path $envFile -Pattern "^\s*$name\s*=\s*\S" -List)) { throw "$envFile ยังไม่มีค่า $name" }
}
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) { throw "ไม่พบ service $ServiceName — รัน deploy\install-service.ps1 ก่อน (ครั้งเดียว)" }

# ---------- เตรียมเวอร์ชันใหม่ ----------
$short = if ($Sha) { $Sha.Substring(0, [Math]::Min(7, $Sha.Length)) } else { 'manual' }
$name = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $short
$releases = Join-Path $AppDir 'releases'
$release = Join-Path $releases $name
New-Item -ItemType Directory -Force -Path $release | Out-Null

Step "คัดลอกไฟล์ไป $release"
Copy-Tree $standalone $release
Copy-Tree (Join-Path $Source '.next\static') (Join-Path $release '.next\static')
if (Test-Path (Join-Path $Source 'public')) { Copy-Tree (Join-Path $Source 'public') (Join-Path $release 'public') }

# build บน Windows สร้าง junction ที่ชี้ path เต็มของโฟลเดอร์ build (เช่น @prisma/client-xxxx)
# สร้างใหม่ให้ชี้ไฟล์ในเวอร์ชันนี้ ไม่งั้นจะพังเมื่อ runner ล้างโฟลเดอร์ build
$standaloneFull = (Resolve-Path $standalone).Path.TrimEnd('\')
Get-ChildItem -Path $standalone -Recurse -Force -Attributes ReparsePoint -ErrorAction SilentlyContinue | ForEach-Object {
  $rel = $_.FullName.Substring($standaloneFull.Length).TrimStart('\')
  $target = @($_.Target)[0]
  if (-not $target) { return }
  if (-not $target.StartsWith($standaloneFull, [StringComparison]::OrdinalIgnoreCase)) { throw "junction $rel ชี้ออกนอกโฟลเดอร์ build: $target" }
  $newLink = Join-Path $release $rel
  $newTarget = Join-Path $release ($target.Substring($standaloneFull.Length).TrimStart('\'))
  if (Test-Path -LiteralPath $newLink) { Remove-Item -LiteralPath $newLink -Recurse -Force }
  New-Item -ItemType Junction -Path $newLink -Target $newTarget | Out-Null
  Write-Host "    junction $rel -> $newTarget"
}

$releaseEnv = Join-Path $release '.env'
Copy-Item -LiteralPath $envFile -Destination $releaseEnv -Force
# สำเนาได้สิทธิ์ตามโฟลเดอร์ ล็อกให้เหมือนต้นฉบับ (Administrators + SYSTEM)
& icacls $releaseEnv /inheritance:r /grant:r 'Administrators:F' 'SYSTEM:F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw "ตั้งสิทธิ์ $releaseEnv ไม่สำเร็จ" }
Set-Content -Path (Join-Path $release 'REVISION') -Value $Sha -Encoding ascii

# ---------- สลับเวอร์ชัน ----------
$current = Join-Path $AppDir 'current'
$previous = $null
if (Test-Path -LiteralPath $current) { $previous = @((Get-Item -LiteralPath $current -Force).Target)[0] }

Step "หยุด service $ServiceName"
Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
(Get-Service -Name $ServiceName).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))

Remove-Junction $current
New-Item -ItemType Junction -Path $current -Target $release | Out-Null

Step "เริ่ม service $ServiceName"
Start-Service -Name $ServiceName
if (-not (Test-App)) {
  Write-Host "!! เวอร์ชันใหม่ไม่ตอบ ดู log ที่ $AppDir\logs"
  if ($previous -and (Test-Path -LiteralPath $previous)) {
    Step "ย้อนกลับไป $previous"
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    (Get-Service -Name $ServiceName).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
    Remove-Junction $current
    New-Item -ItemType Junction -Path $current -Target $previous | Out-Null
    Start-Service -Name $ServiceName
  }
  throw "deploy ไม่สำเร็จ"
}
Step "deploy สำเร็จ: $name"

# ---------- เก็บเฉพาะเวอร์ชันล่าสุด ----------
$active = (Resolve-Path -LiteralPath $release).Path
Get-ChildItem -Path $releases -Directory | Sort-Object Name -Descending | Select-Object -Skip $Keep | ForEach-Object {
  if ($_.FullName -ne $active -and $_.FullName -ne $previous) {
    Write-Host "    ลบเวอร์ชันเก่า $($_.Name)"
    # rmdir /s ไม่ตามเข้า junction และรับ path ยาวได้ดีกว่า Remove-Item
    cmd /c rmdir /s /q "$($_.FullName)"
  }
}
