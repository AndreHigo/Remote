[CmdletBinding()]
param(
  [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$ManifestPath = "",
  [string]$PackageManifestPath = "apps/agent/release/RemotoAgent-Windows/RemotoAgent-package.json",
  [string]$ExpectedVersion = "",
  [switch]$RequireSignature
)

$ErrorActionPreference = "Stop"

function Resolve-UnderRoot {
  param([string]$Path)

  $candidate = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $RootPath $Path }
  $resolved = [System.IO.Path]::GetFullPath($candidate)
  $root = $RootPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Caminho fora da raiz da release: $Path"
  }
  return $resolved
}

$RootPath = [System.IO.Path]::GetFullPath($RootPath)
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
  $ManifestPath = Join-Path $RootPath "release-manifest.json"
} else {
  $ManifestPath = Resolve-UnderRoot -Path $ManifestPath
}

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  throw "Manifesto da release ausente: $ManifestPath"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1) { throw "schemaVersion invalido no manifesto da release." }
if ([string]::IsNullOrWhiteSpace([string]$manifest.version)) { throw "Versao ausente no manifesto da release." }
if ($ExpectedVersion -and [string]$manifest.version -ne $ExpectedVersion) {
  throw "Versao inesperada: $($manifest.version). Esperado: $ExpectedVersion."
}

$artifacts = @($manifest.artifacts)
if ($artifacts.Count -lt 3) { throw "Manifesto da release precisa listar os instaladores e o pacote do agente." }

foreach ($artifact in $artifacts) {
  $relativePath = ([string]$artifact.path).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
  if ([string]::IsNullOrWhiteSpace($relativePath) -or [string]::IsNullOrWhiteSpace([string]$artifact.sha256)) {
    throw "Artefato incompleto no manifesto da release."
  }

  $artifactPath = Resolve-UnderRoot -Path $relativePath
  if (-not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) {
    throw "Artefato ausente: $relativePath"
  }

  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifactPath).Hash.ToLowerInvariant()
  $expectedHash = ([string]$artifact.sha256).Trim().ToLowerInvariant()
  if ($actualHash -ne $expectedHash) {
    throw "SHA-256 nao confere para $relativePath. Esperado $expectedHash, recebido $actualHash."
  }

  if ($RequireSignature -and [bool]$artifact.authenticode) {
    $signature = Get-AuthenticodeSignature -FilePath $artifactPath
    if ($signature.Status -ne "Valid") {
      throw "Assinatura Authenticode invalida para $($relativePath): $($signature.Status)"
    }
  }

  Write-Host ("OK {0} | SHA256 {1}{2}" -f $relativePath, $actualHash, $(if ([bool]$artifact.authenticode) { " | Authenticode verificado" } else { "" }))
}

$packageManifest = Resolve-UnderRoot -Path $PackageManifestPath
if (-not (Test-Path -LiteralPath $packageManifest -PathType Leaf)) {
  throw "Manifesto do pacote do agente ausente: $PackageManifestPath"
}
$package = Get-Content -LiteralPath $packageManifest -Raw | ConvertFrom-Json
if ($package.schemaVersion -ne 1 -or [string]::IsNullOrWhiteSpace([string]$package.version)) {
  throw "Manifesto do pacote do agente invalido."
}
if ($ExpectedVersion -and [string]$package.version -ne $ExpectedVersion) {
  throw "Versao do pacote do agente divergente: $($package.version). Esperado: $ExpectedVersion."
}

Write-Host "Release verificada: versao $($manifest.version), $($artifacts.Count) artefatos."
