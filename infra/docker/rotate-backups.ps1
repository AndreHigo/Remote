[CmdletBinding()]
param(
  [string]$BackupDirectory = "backups",
  [ValidateRange(1, 1000)][int]$KeepCount = 7,
  [switch]$ConfirmDelete
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackupDirectory -PathType Container)) {
  throw "Diretorio de backups nao encontrado: $BackupDirectory"
}

$backupFiles = @(
  Get-ChildItem -LiteralPath $BackupDirectory -Filter "remoto-*.sql.enc" -File |
    Where-Object { $_.Name -match '^remoto-\d{8}-\d{6}\.sql\.enc$' } |
    Sort-Object LastWriteTime -Descending
)
$filesToRemove = @($backupFiles | Select-Object -Skip $KeepCount)

if ($filesToRemove.Count -eq 0) {
  Write-Output "Nenhum backup antigo para rotacionar. Mantendo $($backupFiles.Count) arquivo(s)."
  return
}

Write-Output "Backups mantidos: $([Math]::Min($KeepCount, $backupFiles.Count))"
Write-Output "Backups candidatos a remocao: $($filesToRemove.Count)"
foreach ($file in $filesToRemove) {
  Write-Output ("- {0} ({1} bytes, {2})" -f $file.FullName, $file.Length, $file.LastWriteTime.ToString("s"))
}

if (-not $ConfirmDelete) {
  Write-Output "Simulacao concluida. Para remover somente esses backups, execute novamente com -ConfirmDelete."
  return
}

foreach ($file in $filesToRemove) {
  Remove-Item -LiteralPath $file.FullName -Force
}

Write-Output "Rotacao concluida: $($filesToRemove.Count) backup(s) removido(s); $([Math]::Min($KeepCount, $backupFiles.Count)) mantido(s)."
