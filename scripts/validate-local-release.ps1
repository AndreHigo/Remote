param(
  [switch]$SkipBuild,
  [switch]$SkipAudit
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
  Write-Host "`n== $Label ==" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label falhou com codigo $LASTEXITCODE"
  }
}

Invoke-Checked "Testes" { npm test }
Invoke-Checked "Typecheck" { npm run typecheck }

if (!$SkipBuild) {
  Invoke-Checked "Build" { npm run build }
}

if (!$SkipAudit) {
  Invoke-Checked "Auditoria de dependencias" { npm audit --audit-level=high }
}

Invoke-Checked "Sintaxe do operador nativo" {
  node --check apps/operator/src/main.cjs
  node --check apps/operator/src/preload.cjs
  node --check apps/operator/src/renderer.js
  node --test apps/operator/src/media.test.cjs
}

Invoke-Checked "Tipagem do cliente smoke realtime" {
  npx --no-install tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --esModuleInterop scripts/smoke-realtime-client.ts
}

Write-Host "`n== Hardening do instalador do agente ==" -ForegroundColor Cyan
$serviceInstaller = Get-Content -LiteralPath "apps/agent/scripts/install-windows-service.ps1" -Raw
$packageInstaller = Get-Content -LiteralPath "apps/agent/scripts/install-package.ps1" -Raw
$innoInstaller = Get-Content -LiteralPath "apps/agent/scripts/remoto-agent.iss" -Raw
if (-not (Test-Path -LiteralPath "apps/agent/scripts/repair-installed-agent.ps1")) {
  throw "O pacote do agente precisa conter o script de reparo elevado."
}
if ($packageInstaller -notmatch '(?i)RepairExisting' -or $packageInstaller -notmatch '(?i)Start-ScheduledTask') {
  throw "O instalador do agente precisa suportar reparo e recriar a tarefa interativa."
}
if ($innoInstaller -notmatch '(?i)CloseApplications=force' -or
    $innoInstaller -notmatch '(?i)function StopExistingService: Boolean' -or
    $innoInstaller -notmatch '(?i)Nao foi possivel encerrar o Remoto Agent') {
  throw "O instalador Inno precisa encerrar o agente e abortar claramente quando um arquivo continuar bloqueado."
}
if ($serviceInstaller -match '(?i)LOCALAPPDATA.*Programs') {
  throw "O instalador standalone nao pode aceitar Node de LocalAppData para um servico LocalSystem."
}
if ($serviceInstaller -notmatch '(?i)icacls\.exe\s+\$configPath') {
  throw "O instalador standalone precisa proteger a ACL da configuracao do agente."
}
$hostDiagnostics = Get-Content -LiteralPath "scripts/homologate-host.ps1" -Raw
if ($hostDiagnostics -notmatch '(?i)ffmpegSource' -or $hostDiagnostics -notmatch '(?i)configuredFfmpegPath') {
  throw "O diagnostico do host precisa sondar o FFmpeg configurado/protegido e declarar a origem."
}
Write-Host "Runtime privilegiado e ACL da configuracao verificados." -ForegroundColor Green

Write-Host "`n== Instaladores ==" -ForegroundColor Cyan
$artifacts = @(
  "apps/operator/release/Remoto-Operator-Setup-0.1.0.exe",
  "apps/agent/release/RemotoAgent-Setup.exe"
)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
foreach ($artifact in $artifacts) {
  if (Test-Path -LiteralPath $artifact) {
    $resolvedArtifact = (Resolve-Path -LiteralPath $artifact).Path
    $bytes = [System.IO.File]::ReadAllBytes($resolvedArtifact)
    $hash = ([BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace("-", "")
    Write-Host "$artifact`n  SHA256: $hash"
  } else {
    Write-Warning "Artefato ausente: $artifact"
  }
}
$sha256.Dispose()

Write-Host "`n== Audio de sistema ==" -ForegroundColor Cyan
$ffmpegCommand = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
if (!$ffmpegCommand) {
  Write-Warning "ffmpeg.exe nao esta no PATH; o agente ainda pode localizar uma instalacao confiavel por configuracao ou WinGet."
} else {
  $deviceList = (& $ffmpegCommand.Source -hide_banner -devices 2>&1 | Out-String)
  if ($deviceList -notmatch "(?m)\bwasapi\b") {
    Write-Warning "A build local do FFmpeg nao oferece WASAPI loopback. O modo jogo permanece video-only."
  } else {
    Write-Host "WASAPI listado pela build; ainda requer homologacao de captura e sincronismo." -ForegroundColor Yellow
  }
}

Invoke-Checked "Diff whitespace" { git diff --check }
if ((git status --porcelain)) {
  Write-Warning "Existem alteracoes locais nao commitadas."
}

Write-Host "`nPreflight local concluido. Teste entre duas maquinas, assinatura e VPS continuam gates externos." -ForegroundColor Green
