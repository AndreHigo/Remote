param(
  [string]$EnvFile = "infra/docker/production.env",
  [switch]$Build
)

$ErrorActionPreference = "Stop"
$composeFile = "infra/docker/docker-compose.production.yml"

if (!(Test-Path -LiteralPath $EnvFile)) { throw "Arquivo de ambiente nao encontrado: $EnvFile" }
if (!(Test-Path -LiteralPath $composeFile)) { throw "Compose de producao nao encontrado: $composeFile" }

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
  "JWT_SECRET",
  "TOTP_ENCRYPTION_KEY",
  "RUSTDESK_RELAY_HOST"
)

foreach ($name in $required) {
  if (!$values[$name]) { throw "Variavel obrigatoria ausente: $name" }
}

if ($values["POSTGRES_PASSWORD"].Length -lt 20) { throw "POSTGRES_PASSWORD deve ter pelo menos 20 caracteres" }
if ($values["JWT_SECRET"].Length -lt 32) { throw "JWT_SECRET deve ter pelo menos 32 caracteres" }
if ($values["TOTP_ENCRYPTION_KEY"].Length -lt 32) { throw "TOTP_ENCRYPTION_KEY deve ter pelo menos 32 caracteres" }
if ($values["WEB_DOMAIN"] -match "^https?://") { throw "WEB_DOMAIN deve ser somente o hostname, sem http:// ou https://" }

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
  & docker compose --env-file $EnvFile -f $composeFile build api web
  if ($LASTEXITCODE -ne 0) { throw "build das imagens falhou" }
}

Write-Output "Preflight de producao aprovado para $($values["WEB_DOMAIN"])"
