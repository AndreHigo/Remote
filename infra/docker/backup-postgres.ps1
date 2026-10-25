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
if (!$values["BACKUP_ENCRYPTION_KEY"] -or $values["BACKUP_ENCRYPTION_KEY"].Length -lt 32) {
  throw "BACKUP_ENCRYPTION_KEY deve ter pelo menos 32 caracteres."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tempPath = Join-Path $OutputDirectory "remoto-$stamp.sql.tmp"
$outputPath = Join-Path $OutputDirectory "remoto-$stamp.sql.enc"
$composeFile = "infra/docker/docker-compose.production.yml"

try {
  & docker compose --env-file $EnvFile -f $composeFile exec -T postgres pg_dump -U $values["POSTGRES_USER"] -d $values["POSTGRES_DB"] | Set-Content -LiteralPath $tempPath -AsByteStream
  if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou com codigo $LASTEXITCODE" }

  $plain = [IO.File]::ReadAllBytes($tempPath)
  if ($plain.Length -lt 100) { throw "Backup gerado parece vazio: $tempPath" }

  $sha = [Security.Cryptography.SHA256]::Create()
  $key = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($values["BACKUP_ENCRYPTION_KEY"]))
  $aes = [Security.Cryptography.Aes]::Create()
  $aes.Mode = [Security.Cryptography.CipherMode]::CBC
  $aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
  $aes.Key = $key
  $aes.GenerateIV()
  $cipher = $aes.CreateEncryptor().TransformFinalBlock($plain, 0, $plain.Length)
  $macInput = New-Object byte[] ($aes.IV.Length + $cipher.Length)
  [Buffer]::BlockCopy($aes.IV, 0, $macInput, 0, $aes.IV.Length)
  [Buffer]::BlockCopy($cipher, 0, $macInput, $aes.IV.Length, $cipher.Length)
  $tag = ([Security.Cryptography.HMACSHA256]::new($key)).ComputeHash($macInput)
  $payload = [IO.MemoryStream]::new()
  $magic = [Text.Encoding]::ASCII.GetBytes("RMBK1")
  $payload.Write($magic, 0, $magic.Length)
  $payload.Write($aes.IV, 0, $aes.IV.Length)
  $payload.Write($cipher, 0, $cipher.Length)
  $payload.Write($tag, 0, $tag.Length)
  [IO.File]::WriteAllBytes($outputPath, $payload.ToArray())
} finally {
  Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
}

if (Get-Command icacls.exe -ErrorAction SilentlyContinue) {
  & icacls.exe $outputPath /inheritance:r /grant:r "$($env:USERNAME):(F)" | Out-Null
} elseif (Get-Command chmod -ErrorAction SilentlyContinue) {
  & chmod 600 $outputPath
}

$file = Get-Item -LiteralPath $outputPath
Write-Output "Backup criptografado criado: $($file.FullName) ($($file.Length) bytes)"
