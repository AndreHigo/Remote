param(
  [string]$EnvFile = "infra/docker/production.env",
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $EnvFile)) {
  throw "Arquivo de ambiente nao encontrado: $EnvFile"
}

$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and !$line.StartsWith("#") -and $line.Contains("=")) {
    $name, $value = $line.Split("=", 2)
    $values[$name.Trim()] = $value.Trim().Trim('"')
  }
}

foreach ($required in @("POSTGRES_USER", "POSTGRES_DB")) {
  if (!$values[$required]) { throw "Variavel ausente no arquivo de ambiente: $required" }
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputPath = Join-Path $OutputDirectory "remoto-$stamp.sql"
$composeFile = "infra/docker/docker-compose.production.yml"

& docker compose --env-file $EnvFile -f $composeFile exec -T postgres pg_dump -U $values["POSTGRES_USER"] -d $values["POSTGRES_DB"] | Set-Content -LiteralPath $outputPath -AsByteStream
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
  throw "pg_dump falhou com codigo $LASTEXITCODE"
}

$file = Get-Item -LiteralPath $outputPath
if ($file.Length -lt 100) {
  Remove-Item -LiteralPath $outputPath -Force
  throw "Backup gerado parece vazio: $outputPath"
}

Write-Output "Backup criado: $($file.FullName) ($($file.Length) bytes)"
