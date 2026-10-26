[CmdletBinding()]
param(
  [string]$PostgresPassword = "remoto-local-postgres-password-123456",
  [switch]$KeepPostgres
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$composeFile = "infra/docker/docker-compose.yml"
$databaseUrl = "postgresql://remoto:$PostgresPassword@127.0.0.1:55432/remoto?schema=public"
$runId = [Guid]::NewGuid().ToString("N")
$tempRoot = Join-Path $env:TEMP "remoto-smoke-$runId"
$statePath = Join-Path $tempRoot "agent-state.json"
$apiLog = Join-Path $tempRoot "api.log"
$apiErrorLog = Join-Path $tempRoot "api-error.log"
$realtimeLog = Join-Path $tempRoot "realtime.log"
$realtimeErrorLog = Join-Path $tempRoot "realtime-error.log"
$agentLog = Join-Path $tempRoot "agent-sessions.log"
$agentErrorLog = Join-Path $tempRoot "agent-sessions-error.log"
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$sessionId = $null
$loginToken = $null
$apiProcess = $null
$realtimeProcess = $null
$agentProcess = $null

function Invoke-Checked {
  param(
    [string]$Label,
    [string]$FilePath,
    [string[]]$Arguments
  )

  Write-Host "== $Label ==" -ForegroundColor Cyan
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label falhou com codigo $LASTEXITCODE."
  }
}

function Wait-HttpReady {
  param(
    [string]$Uri,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = "sem resposta"
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Uri $Uri -TimeoutSec 3
      if ($response.ok -eq $true) { return $response }
      $lastError = "resposta sem ok=true"
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Seconds 2
  }
  throw "Servico nao ficou pronto em ${Uri}: $lastError"
}

function Start-WorkspaceProcess {
  param(
    [string]$Label,
    [string[]]$Arguments,
    [string]$OutputPath,
    [string]$ErrorPath
  )

  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  $process = Start-Process -FilePath $npm -ArgumentList $Arguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $OutputPath -RedirectStandardError $ErrorPath -PassThru
  $processes.Add($process)
  Write-Host "$Label iniciado (PID $($process.Id))" -ForegroundColor DarkGray
  return $process
}

function Stop-ProcessTree {
  param([System.Diagnostics.Process]$Process)
  if (-not $Process) { return }
  try {
    if (-not $Process.HasExited) {
      & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
    }
  } catch {
    # O processo pode ter encerrado durante a limpeza.
  }
}

function Read-LogText {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) { return Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue }
  return ""
}

try {
  if (-not (Get-Command docker.exe -ErrorAction SilentlyContinue)) { throw "Docker nao encontrado no PATH." }
  & docker version --format '{{.Server.Version}}' 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "O daemon do Docker nao esta disponivel. Inicie o Docker Desktop e tente novamente." }

  [System.IO.Directory]::CreateDirectory($tempRoot) | Out-Null
  $env:POSTGRES_PASSWORD = $PostgresPassword
  $env:DATABASE_URL = $databaseUrl
  $env:JWT_SECRET = "local-jwt-secret-123456789012345678901234"
  $env:DESKTOP_SESSION_SECRET = "local-desktop-session-secret-123456789012345678901234"
  $env:TOTP_ENCRYPTION_KEY = "local-totp-secret-123456789012345678901234"
  $env:REALTIME_INTERNAL_SECRET = "local-realtime-secret-123456789012345678901234"
  $env:ENABLE_GAME_MODE = "true"
  $env:WEB_ORIGIN = "http://127.0.0.1:5173"
  $env:REALTIME_CONTROL_URL = "http://127.0.0.1:4200"
  $env:REALTIME_API_URL = "http://127.0.0.1:4100"
  $env:REALTIME_ALLOWED_ORIGINS = "http://127.0.0.1:5173"
  $env:SEED_CONFIRMATION = "RESET_LOCAL_DEMO_DATA"
  $env:SEED_OWNER_PASSWORD = "local-owner-password-123"
  $env:SEED_TECHNICIAN_PASSWORD = "local-technician-password-123"
  $env:SEED_VIEWER_PASSWORD = "local-viewer-password-123"
  $env:SEED_AGENT_KEY = "rm_local_agent_key_123456"

  Invoke-Checked "Postgres local" "docker.exe" @("compose", "-f", $composeFile, "up", "-d", "postgres")
  $deadline = (Get-Date).AddSeconds(60)
  do {
    $health = & docker.exe inspect -f '{{.State.Health.Status}}' remoto-postgres 2>$null
    if ($health -eq "healthy") { break }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  if ($health -ne "healthy") { throw "O container remoto-postgres nao ficou healthy." }

  Invoke-Checked "Schema Prisma" "npm.cmd" @("run", "db:push")
  Invoke-Checked "Seed local" "npm.cmd" @("run", "db:seed")

  $apiProcess = Start-WorkspaceProcess "API" @("run", "dev", "-w", "services/api") $apiLog $apiErrorLog
  $realtimeProcess = Start-WorkspaceProcess "Relay realtime" @("run", "dev", "-w", "services/realtime") $realtimeLog $realtimeErrorLog
  $health = Wait-HttpReady "http://127.0.0.1:4100/health"
  $ready = Wait-HttpReady "http://127.0.0.1:4100/ready"
  Wait-HttpReady "http://127.0.0.1:4200/health" | Out-Null
  if ($health.gameMode -ne "experimental") { throw "Modo jogo local nao ficou experimentalmente habilitado." }
  if ($ready.database -ne "ready") { throw "Banco local nao ficou pronto." }

  $env:REMOTO_API_URL = "http://127.0.0.1:4100"
  $env:REMOTO_REALTIME_URL = "ws://127.0.0.1:4200"
  $env:REMOTO_AGENT_KEY = $env:SEED_AGENT_KEY
  $env:REMOTO_AGENT_STATE = $statePath
  $env:REMOTO_DEVICE_NAME = "SMOKE-HOST-$($runId.Substring(0, 8))"
  $env:REMOTO_AGENT_SESSION_SECONDS = "2"
  $env:REMOTO_CAPTURE_ENCODER = "cpu"
  $env:REMOTO_CAPTURE_METHOD = "gdigrab"

  Invoke-Checked "Cadastro do agente" "npm.cmd" @("run", "agent:register")
  Invoke-Checked "Heartbeat do agente" "npm.cmd" @("run", "agent:heartbeat")

  $loginBody = @{ email = "admin@remoto.local"; password = $env:SEED_OWNER_PASSWORD } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/auth/login" -ContentType "application/json" -Body $loginBody
  $loginToken = $login.token
  $headers = @{ Authorization = "Bearer $loginToken" }
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  $requestBody = @{ deviceId = $state.deviceId; reason = "Smoke test local do canal de jogo"; mode = "game" } | ConvertTo-Json

  $blockedRequest = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/remote-sessions" -Headers $headers -ContentType "application/json" -Body $requestBody
  try {
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/remote-sessions/$($blockedRequest.id)/approve" -Headers $headers | Out-Null
    throw "O gate de capacidade aprovou uma sessao game sem inventario atualizado."
  } catch {
    $statusCode = 0
    if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode.value__ }
    if ($statusCode -ne 409) { throw }
    Write-Host "Gate game bloqueou corretamente a sessao sem inventario (HTTP 409)." -ForegroundColor DarkGray
  }
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/remote-sessions/$($blockedRequest.id)/deny" -Headers $headers | Out-Null

  Invoke-Checked "Inventario do agente" "npm.cmd" @("run", "agent:inventory")
  Invoke-Checked "Comandos do agente" "npm.cmd" @("run", "agent:commands")

  $device = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:4100/devices/$($state.deviceId)" -Headers $headers
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/devices/$($state.deviceId)/archive" -Headers $headers | Out-Null
  try {
    Invoke-RestMethod -Method Delete -Uri "http://127.0.0.1:4100/customers/$($device.customerId)" -Headers $headers | Out-Null
    throw "A exclusao aceitou um cliente que ainda possui dispositivo arquivado."
  } catch {
    $statusCode = 0
    if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode.value__ }
    if ($statusCode -ne 409) { throw }
    Write-Host "Exclusao de cliente com dispositivo arquivado bloqueada corretamente (HTTP 409)." -ForegroundColor DarkGray
  }
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/devices/$($state.deviceId)/restore" -Headers $headers | Out-Null

  $requested = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/remote-sessions" -Headers $headers -ContentType "application/json" -Body $requestBody
  $sessionId = $requested.id
  $approved = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/remote-sessions/$sessionId/approve" -Headers $headers
  $accessToken = $approved.connection.desktopSession.accessToken
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/desktop-sessions/consume" -ContentType "application/json" -Body (@{ accessToken = $accessToken } | ConvertTo-Json) | Out-Null

  $agentProcess = Start-WorkspaceProcess "Sessao host do agente" @("run", "agent:sessions") $agentLog $agentErrorLog
  $deadline = (Get-Date).AddSeconds(20)
  $connected = $false
  while ((Get-Date) -lt $deadline) {
    $agentOutput = Read-LogText $agentLog
    if ($agentOutput -match "sessao remota host conectada") { $connected = $true; break }
    if ($agentProcess.HasExited) { break }
    Start-Sleep -Seconds 1
  }
  if (-not $connected) {
    $details = (Read-LogText $agentLog) + "`n" + (Read-LogText $agentErrorLog)
    throw "O agente nao conectou o host ao relay.`n$details"
  }

  $env:MEASURE_SESSION_ID = $sessionId
  $env:MEASURE_DEVICE_ID = $state.deviceId
  $env:MEASURE_ACCESS_TOKEN = $accessToken
  $env:MEASURE_REALTIME_URL = "ws://127.0.0.1:4200"
  $env:MEASURE_DURATION_SECONDS = "5"
  $env:MEASURE_FIRST_FRAME_TIMEOUT_SECONDS = "20"
  $measurementReportPath = Join-Path $tempRoot "realtime-measurement.json"
  $env:MEASURE_OUTPUT_PATH = $measurementReportPath
  $clientLog = Join-Path $tempRoot "smoke-client.log"
  $clientErrorLog = Join-Path $tempRoot "smoke-client-error.log"
  $clientProcess = Start-WorkspaceProcess "Medicao realtime smoke" @("exec", "--", "tsx", "scripts/measure-realtime-session.ts") $clientLog $clientErrorLog
  if (-not $clientProcess.WaitForExit(45000)) {
    Stop-ProcessTree $clientProcess
    throw "A medicao realtime nao terminou em 45 segundos."
  }
  $clientOutput = (Read-LogText $clientLog) + "`n" + (Read-LogText $clientErrorLog)
  if (-not (Test-Path -LiteralPath $measurementReportPath)) {
    throw "A medicao realtime falhou.`n$clientOutput"
  }
  $measurement = Get-Content -LiteralPath $measurementReportPath -Raw | ConvertFrom-Json
  if ($measurement.result -ne "pass") {
    throw "A medicao realtime nao aprovou o canal.`n$clientOutput"
  }
  if ($null -ne $clientProcess.ExitCode -and $clientProcess.ExitCode -ne 0) {
    Write-Warning ("O wrapper npm terminou com codigo {0}, mas o relatorio realtime foi gerado e aprovado." -f $clientProcess.ExitCode)
  }

  Write-Host "Smoke test local aprovado: API, banco, agente, captura FFmpeg, primeiro frame, sessao game e relay." -ForegroundColor Green
  Write-Host ("Medicao local: primeiro frame={0}ms, FPS={1}, bitrate={2}kbps, RTT medio={3}ms, RTT p95={4}ms, descartes={5}." -f $measurement.firstFrameMs, $measurement.fpsReceived, $measurement.bitrateKbps, $measurement.latencyAvgMs, $measurement.latencyP95Ms, $measurement.relayDroppedFrames) -ForegroundColor Green
  Write-Host "Limite: essa medicao e local; entrada, audio, gamepad e homologacao entre duas maquinas exigem clientes Windows separados." -ForegroundColor Yellow
} finally {
  if ($sessionId -and $loginToken) {
    try {
      Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4100/desktop-sessions/end" -ContentType "application/json" -Body (@{ accessToken = $accessToken } | ConvertTo-Json) | Out-Null
    } catch { }
  }
  Stop-ProcessTree $clientProcess
  Stop-ProcessTree $agentProcess
  Stop-ProcessTree $apiProcess
  Stop-ProcessTree $realtimeProcess
  if (-not $KeepPostgres) {
    try { & docker.exe compose -f $composeFile stop postgres | Out-Null } catch { }
  }
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
