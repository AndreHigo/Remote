param(
  [string]$PostgresPassword = "remoto"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$env:POSTGRES_PASSWORD = $PostgresPassword
$env:DATABASE_URL = "postgresql://remoto:$PostgresPassword@127.0.0.1:55432/remoto?schema=public"
$env:PORT = "4100"
$env:WEB_ORIGIN = "http://localhost:5173,http://127.0.0.1:5173"
$env:JWT_SECRET = "local-jwt-secret-123456789012345678901234"
$env:DESKTOP_SESSION_SECRET = "local-desktop-session-secret-123456789012345678901234"
$env:TOTP_ENCRYPTION_KEY = "local-totp-secret-123456789012345678901234"
$env:REALTIME_INTERNAL_SECRET = "local-realtime-secret-123456789012345678901234"
$env:REALTIME_CONTROL_URL = "http://127.0.0.1:4200"
$env:ENABLE_GAME_MODE = "true"
$env:REALTIME_PORT = "4200"
$env:REALTIME_API_URL = "http://127.0.0.1:4100"
$env:REALTIME_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:VITE_API_URL = "http://localhost:4100"
$env:VITE_REALTIME_URL = "ws://localhost:4200"

$logRoot = Join-Path $env:ProgramData "Remoto\logs"
[System.IO.Directory]::CreateDirectory($logRoot) | Out-Null

function Wait-HttpReady {
  param([string]$Uri)
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Uri $Uri -TimeoutSec 3
      if ($response.ok -eq $true) { return }
    } catch { }
    Start-Sleep -Seconds 2
  }
  throw "Servico nao ficou pronto: $Uri"
}

function Start-WorkspaceProcess {
  param([string]$Name, [string[]]$Arguments)
  $stdout = Join-Path $logRoot "$Name.stdout.log"
  $stderr = Join-Path $logRoot "$Name.stderr.log"
  Remove-Item $stdout, $stderr -Force -ErrorAction SilentlyContinue
  return Start-Process npm.cmd -ArgumentList $Arguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
}

function Ensure-DockerReady {
  try {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }
  } catch { }

  $dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path -LiteralPath $dockerDesktop)) {
    throw "Docker Desktop nao foi encontrado em $dockerDesktop."
  }

  Write-Host "Docker Desktop nao esta pronto. Iniciando..." -ForegroundColor Yellow
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddMinutes(2)
  while ((Get-Date) -lt $deadline) {
    try {
      docker info *> $null
      if ($LASTEXITCODE -eq 0) { return }
    } catch { }
    Start-Sleep -Seconds 5
  }

  throw "Docker Desktop nao ficou pronto em 2 minutos."
}

Ensure-DockerReady
docker compose -f infra/docker/docker-compose.yml up -d postgres | Out-Host
$deadline = (Get-Date).AddSeconds(60)
do {
  $health = docker inspect -f '{{.State.Health.Status}}' remoto-postgres 2>$null
  if ($health -eq "healthy") { break }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
if ($health -ne "healthy") { throw "PostgreSQL local nao ficou healthy." }

npm run db:push
$api = Start-WorkspaceProcess "api-dev" @("run", "dev", "-w", "services/api")
$relay = Start-WorkspaceProcess "realtime-dev" @("run", "dev", "-w", "services/realtime")
$web = Start-WorkspaceProcess "web-dev" @("run", "dev", "-w", "apps/web")

Wait-HttpReady "http://127.0.0.1:4100/health"
Wait-HttpReady "http://127.0.0.1:4100/ready"
Wait-HttpReady "http://127.0.0.1:4200/health"

$stack = @{
  apiPid = $api.Id
  relayPid = $relay.Id
  webPid = $web.Id
  apiUrl = "http://localhost:4100"
  realtimeUrl = "ws://localhost:4200"
  webUrl = "http://localhost:5173"
  logs = $logRoot
}
$stack | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot "local-stack.json") -Encoding UTF8
Write-Host "Stack local pronto: http://localhost:5173" -ForegroundColor Green
Write-Host "API: http://localhost:4100 | Relay: http://localhost:4200" -ForegroundColor DarkGray
Write-Host "Logs: $logRoot" -ForegroundColor DarkGray
