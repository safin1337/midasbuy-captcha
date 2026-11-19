# Backward-compatible root command. Click-order implementation lives in Format_B.
param(
    [Parameter(Mandatory=$true)][string]$Image,
    [string]$Output,
    [string]$ReferenceBox,
    [string]$SceneBox,
    [ValidateRange(1,6)][int]$Count = 3,
    [switch]$CandidatesOnly,
    [switch]$LegacyMatcher
)
$ErrorActionPreference = 'Stop'
if (-not $Output) { $Output = Join-Path $PSScriptRoot 'Format_B\output' }
if (-not (Test-Path -LiteralPath $Image -PathType Leaf) -and -not [IO.Path]::IsPathRooted($Image)) {
    $formatImage = Join-Path (Join-Path $PSScriptRoot 'Format_B\raw_data') ([IO.Path]::GetFileName($Image))
    if (Test-Path -LiteralPath $formatImage -PathType Leaf) { $Image = $formatImage }
}
& (Join-Path $PSScriptRoot 'Format_B\detect.ps1') -Image $Image -Output $Output -ReferenceBox $ReferenceBox -SceneBox $SceneBox -Count $Count -CandidatesOnly:$CandidatesOnly -LegacyMatcher:$LegacyMatcher
exit $LASTEXITCODE
