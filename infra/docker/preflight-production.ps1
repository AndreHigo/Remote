param(
  [string]$EnvFile = "infra/docker/production.env",
  [switch]$Build
)

$ErrorActionPreference = "Stop"
$composeFile = "infra/docker/docker-compose.production.yml"
$installerHostPath = Join-Path (Split-Path -Parent $composeFile) "release\RemotoAgent-Setup.exe"

if (!(Test-Path -LiteralPath $EnvFile)) { throw "Arquivo de ambiente nao encontrado: $EnvFile" }
if (!(Test-Path -LiteralPath $composeFile)) { throw "Compose de producao nao encontrado: $composeFile" }
if (!(Test-Path -LiteralPath $installerHostPath -PathType Leaf)) {
  throw "Instalador do agente ausente: $installerHostPath. Gere uma release Windows assinada e copie o arquivo para infra/docker/release antes do deploy."
}

$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and !$line.StartsWith("#") -and $line.Contains("=")) {
    $name, $value = $line.Split("=", 2)
    $values[$name.Trim()] = $value.Trim().Trim('"')
  }
}

$required = @(
  "WEB_DOMAIN",
  "ACME_EMAIL",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "BACKUP_ENCRYPTION_KEY",
  "JWT_SECRET",
  "DESKTOP_SESSION_SECRET",
  "TOTP_ENCRYPTION_KEY",
  "REDIS_URL",
  "REALTIME_INTERNAL_SECRET",
  "REALTIME_ALLOWED_ORIGINS",
  "BOOTSTRAP_ADMIN_NAME",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "RUSTDESK_RELAY_HOST"
)

foreach ($name in $required) {
  if (!$values[$name]) { throw "Variavel obrigatoria ausente: $name" }
}

if ($values["POSTGRES_PASSWORD"].Length -lt 20) { throw "POSTGRES_PASSWORD deve ter pelo menos 20 caracteres" }
if ($values["BACKUP_ENCRYPTION_KEY"].Length -lt 32) { throw "BACKUP_ENCRYPTION_KEY deve ter pelo menos 32 caracteres" }
if ($values["JWT_SECRET"].Length -lt 32) { throw "JWT_SECRET deve ter pelo menos 32 caracteres" }
if ($values["DESKTOP_SESSION_SECRET"].Length -lt 32) { throw "DESKTOP_SESSION_SECRET deve ter pelo menos 32 caracteres" }
if ($values["TOTP_ENCRYPTION_KEY"].Length -lt 32) { throw "TOTP_ENCRYPTION_KEY deve ter pelo menos 32 caracteres" }
if ($values["REDIS_URL"] -notmatch "^rediss://") { throw "REDIS_URL deve usar rediss:// (Redis com TLS)" }
if ($values["REALTIME_INTERNAL_SECRET"].Length -lt 32) { throw "REALTIME_INTERNAL_SECRET deve ter pelo menos 32 caracteres" }
if ($values["BOOTSTRAP_ADMIN_PASSWORD"].Length -lt 12) { throw "BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos 12 caracteres" }
if ($values.ContainsKey("ENABLE_GAME_MODE") -and $values["ENABLE_GAME_MODE"] -notin @("true", "false")) { throw "ENABLE_GAME_MODE deve ser true ou false" }
if ($values["ENABLE_GAME_MODE"] -ne "true") { Write-Warning "ENABLE_GAME_MODE nao esta como true; o acesso remoto de suporte continua disponivel, mas o modo jogo sera bloqueado." }
if ($values["ACME_EMAIL"] -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") { throw "ACME_EMAIL invalido" }
if ($values["BOOTSTRAP_ADMIN_EMAIL"] -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") { throw "BOOTSTRAP_ADMIN_EMAIL invalido" }
if ($values["WEB_DOMAIN"] -notmatch "^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$") { throw "WEB_DOMAIN deve ser um hostname valido, sem protocolo, porta ou caminho" }
if ($values["RUSTDESK_RELAY_HOST"] -notmatch "^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$") { throw "RUSTDESK_RELAY_HOST deve ser somente um hostname ou IP, sem protocolo, porta ou caminho" }

$expectedWebOrigin = "https://$($values["WEB_DOMAIN"])"
$origins = $values["REALTIME_ALLOWED_ORIGINS"].Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($origins.Count -eq 0 -or $origins -contains "*") { throw "REALTIME_ALLOWED_ORIGINS deve listar origens HTTPS explicitas" }
if ($origins -notcontains $expectedWebOrigin) { throw "REALTIME_ALLOWED_ORIGINS deve incluir $expectedWebOrigin" }
foreach ($origin in $origins) {
  try { $originUri = [Uri]$origin } catch { throw "Origem realtime invalida: $origin" }
  if (-not $originUri.IsAbsoluteUri -or $originUri.Scheme -ne "https" -or $originUri.PathAndQuery -ne "/" -or $originUri.UserInfo) {
    throw "Origem realtime deve ser HTTPS, sem caminho, query ou credenciais: $origin"
  }
}

if ($values["DESKTOP_SESSION_SECRET"] -eq $values["JWT_SECRET"]) { throw "DESKTOP_SESSION_SECRET deve ser diferente de JWT_SECRET" }
if ($values["TOTP_ENCRYPTION_KEY"] -eq $values["JWT_SECRET"]) { throw "TOTP_ENCRYPTION_KEY deve ser diferente de JWT_SECRET" }
if ($values["REALTIME_INTERNAL_SECRET"] -eq $values["DESKTOP_SESSION_SECRET"]) { throw "REALTIME_INTERNAL_SECRET deve ser diferente de DESKTOP_SESSION_SECRET" }

$secretNames = @("POSTGRES_PASSWORD", "BACKUP_ENCRYPTION_KEY", "JWT_SECRET", "DESKTOP_SESSION_SECRET", "TOTP_ENCRYPTION_KEY", "REALTIME_INTERNAL_SECRET", "BOOTSTRAP_ADMIN_PASSWORD")
$seenSecrets = @{}
foreach ($name in $secretNames) {
  $secretValue = [string]$values[$name]
  if ($seenSecrets.ContainsKey($secretValue)) { throw "$name nao pode reutilizar o mesmo segredo de $($seenSecrets[$secretValue])" }
  $seenSecrets[$secretValue] = $name
}

$unsafeValues = @("example.com", "troque", "change-this", "localhost", "127.0.0.1")
foreach ($name in $required) {
  foreach ($unsafe in $unsafeValues) {
    if ($values[$name].ToLowerInvariant().Contains($unsafe)) {
      throw "Valor de exemplo ou local detectado em $name"
    }
  }
}

& docker compose --env-file $EnvFile -f $composeFile config --quiet
if ($LASTEXITCODE -ne 0) { throw "docker compose config falhou" }

if ($Build) {
  & docker compose --env-file $EnvFile -f $composeFile build api web realtime
  if ($LASTEXITCODE -ne 0) { throw "build das imagens falhou" }
}

Write-Output "Preflight de producao aprovado para $($values["WEB_DOMAIN"])"
