[CmdletBinding()]
param(
  [string]$EnvFile = "infra/docker/production.env",
  [Parameter(Mandatory = $true)][string]$BackupPath,
  [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmRestore) {
  throw "Restauracao sobrescreve dados do banco. Use -ConfirmRestore explicitamente."
}
if (-not (Test-Path -LiteralPath $EnvFile)) { throw "Arquivo de ambiente nao encontrado: $EnvFile" }
if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) { throw "Backup nao encontrado: $BackupPath" }

$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and !$line.StartsWith("#") -and $line.Contains("=")) {
    $name, $value = $line.Split("=", 2)
    $values[$name.Trim()] = $value.Trim().Trim('"')
  }
}

foreach ($required in @("POSTGRES_USER", "POSTGRES_DB", "BACKUP_ENCRYPTION_KEY")) {
  if (-not $values[$required]) { throw "Variavel ausente no arquivo de ambiente: $required" }
}
if ($values["BACKUP_ENCRYPTION_KEY"].Length -lt 32) {
  throw "BACKUP_ENCRYPTION_KEY deve ter pelo menos 32 caracteres."
}

function Test-ByteArrayEqualConstantTime {
  param([byte[]]$Left, [byte[]]$Right)

  if ($Left.Length -ne $Right.Length) { return $false }
  [byte]$difference = 0
  for ($index = 0; $index -lt $Left.Length; $index++) {
    $difference = $difference -bor ($Left[$index] -bxor $Right[$index])
  }
  return $difference -eq 0
}

$payload = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $BackupPath).Path)
$magic = [Text.Encoding]::ASCII.GetBytes("RMBK1")
if ($payload.Length -lt ($magic.Length + 16 + 32 + 1)) { throw "Arquivo de backup truncado ou invalido." }
for ($index = 0; $index -lt $magic.Length; $index++) {
  if ($payload[$index] -ne $magic[$index]) { throw "Formato de backup desconhecido." }
}

$iv = New-Object byte[] 16
[Buffer]::BlockCopy($payload, $magic.Length, $iv, 0, $iv.Length)
$tagLength = 32
$cipherOffset = $magic.Length + $iv.Length
$cipherLength = $payload.Length - $cipherOffset - $tagLength
$cipher = New-Object byte[] $cipherLength
$tag = New-Object byte[] $tagLength
[Buffer]::BlockCopy($payload, $cipherOffset, $cipher, 0, $cipher.Length)
[Buffer]::BlockCopy($payload, $cipherOffset + $cipher.Length, $tag, 0, $tag.Length)

$sha = [Security.Cryptography.SHA256]::Create()
$key = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($values["BACKUP_ENCRYPTION_KEY"]))
$macInput = New-Object byte[] ($iv.Length + $cipher.Length)
[Buffer]::BlockCopy($iv, 0, $macInput, 0, $iv.Length)
[Buffer]::BlockCopy($cipher, 0, $macInput, $iv.Length, $cipher.Length)
$expectedTag = ([Security.Cryptography.HMACSHA256]::new($key)).ComputeHash($macInput)
if (-not (Test-ByteArrayEqualConstantTime -Left $expectedTag -Right $tag)) {
  throw "Integridade do backup invalida: chave errada ou arquivo adulterado."
}

$aes = [Security.Cryptography.Aes]::Create()
$aes.Mode = [Security.Cryptography.CipherMode]::CBC
$aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
$aes.Key = $key
$aes.IV = $iv
$plain = $aes.CreateDecryptor().TransformFinalBlock($cipher, 0, $cipher.Length)
if ($plain.Length -lt 100) { throw "Backup descriptografado parece vazio." }

$composeFile = "infra/docker/docker-compose.production.yml"
$arguments = @(
  "compose", "--env-file", $EnvFile, "-f", $composeFile,
  "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1",
  "-U", $values["POSTGRES_USER"], "-d", $values["POSTGRES_DB"]
)
$startInfo = [Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = "docker"
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
if ($startInfo.PSObject.Properties.Name -contains "ArgumentList") {
  foreach ($argument in $arguments) { [void]$startInfo.ArgumentList.Add($argument) }
} else {
  $startInfo.Arguments = (($arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join " ")
}

$process = [Diagnostics.Process]::new()
$process.StartInfo = $startInfo
if (-not $process.Start()) { throw "Nao foi possivel iniciar o Docker para restaurar o backup." }
$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()
$process.StandardInput.BaseStream.Write($plain, 0, $plain.Length)
$process.StandardInput.Close()
$process.WaitForExit()
$stdout = $stdoutTask.GetAwaiter().GetResult()
$stderr = $stderrTask.GetAwaiter().GetResult()
if ($process.ExitCode -ne 0) {
  throw "Restauracao via psql falhou com codigo $($process.ExitCode): $stderr"
}

Write-Output "Restauracao concluida em $($values["POSTGRES_DB"]) usando $BackupPath"
