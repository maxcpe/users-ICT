<#
  ติดตั้ง Windows service ของระบบจัดการผู้ใช้ด้วย NSSM — รันครั้งเดียว (PowerShell แบบ Run as administrator)
    .\deploy\install-service.ps1
    .\deploy\install-service.ps1 -Nssm 'C:\nssm\win64\nssm.exe'

  service รัน `node server.js` ในโฟลเดอร์ C:\Web\users\current ฟังเฉพาะ 127.0.0.1:3006 (nginx ส่งต่อมา)
  ยังไม่เริ่ม service จนกว่าจะ deploy ครั้งแรก
#>
param(
  [string]$Nssm = 'nssm',
  [string]$AppDir = 'C:\Web\users',
  [string]$ServiceName = 'users',
  [int]$Port = 3006,
  [string]$Node = ''
)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'ต้องเปิด PowerShell แบบ Run as administrator' }

if (-not (Get-Command $Nssm -ErrorAction SilentlyContinue)) { throw "ไม่พบ nssm ระบุ path ด้วย -Nssm 'C:\...\nssm.exe'" }
if (-not $Node) { $Node = (Get-Command node -ErrorAction Stop).Source }
Write-Host "node: $Node ($(& $Node -v))"

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) { throw "มี service ชื่อ $ServiceName อยู่แล้ว" }
# spec 11.1: 3000-3005 ใช้แล้ว ตรวจว่าพอร์ตว่าง
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "พอร์ต $Port มีโปรแกรมอื่นใช้อยู่" }

foreach ($d in $AppDir, "$AppDir\releases", "$AppDir\logs") { New-Item -ItemType Directory -Force -Path $d | Out-Null }

& $Nssm install $ServiceName $Node 'server.js'
& $Nssm set $ServiceName AppDirectory "$AppDir\current"
& $Nssm set $ServiceName AppEnvironmentExtra 'NODE_ENV=production' "PORT=$Port" 'HOSTNAME=127.0.0.1'
& $Nssm set $ServiceName DisplayName 'ICT Users (ระบบจัดการผู้ใช้)'
& $Nssm set $ServiceName Description 'service.ict.up.ac.th/users — Next.js port 3006'
& $Nssm set $ServiceName Start SERVICE_AUTO_START
& $Nssm set $ServiceName AppStdout "$AppDir\logs\out.log"
& $Nssm set $ServiceName AppStderr "$AppDir\logs\error.log"
& $Nssm set $ServiceName AppRotateFiles 1
& $Nssm set $ServiceName AppRotateOnline 1
& $Nssm set $ServiceName AppRotateBytes 10485760
& $Nssm set $ServiceName AppExit Default Restart
& $Nssm set $ServiceName AppRestartDelay 5000
& $Nssm set $ServiceName AppStopMethodConsole 5000

# .env มีรหัสผ่านฐานและคีย์ HMAC: ให้อ่านได้เฉพาะ Administrators และ SYSTEM
$envFile = "$AppDir\.env"
if (Test-Path $envFile) {
  & icacls $envFile /inheritance:r /grant:r 'Administrators:F' 'SYSTEM:F' | Out-Null
  Write-Host "จำกัดสิทธิ์ $envFile แล้ว"
} else {
  Write-Host "ยังไม่มี $envFile — สร้างจาก .env.example แล้วรัน: icacls $envFile /inheritance:r /grant:r Administrators:F SYSTEM:F"
}

Write-Host "ติดตั้ง service $ServiceName แล้ว (ยังไม่เริ่ม) — deploy ครั้งแรกด้วย GitHub Actions หรือ .\deploy\deploy.ps1"
