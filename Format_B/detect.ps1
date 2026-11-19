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
if (-not $Output) { $Output = Join-Path $PSScriptRoot 'output' }
$pythonExecutable = Join-Path (Split-Path -Parent $PSScriptRoot) '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExecutable)) { throw 'Missing .venv. Create it with Python and install requirements.txt first.' }
if (-not (Test-Path -LiteralPath $Image -PathType Leaf) -and -not [IO.Path]::IsPathRooted($Image)) {
    $rawImage = Join-Path (Join-Path $PSScriptRoot 'raw_data') ([IO.Path]::GetFileName($Image))
    if (Test-Path -LiteralPath $rawImage -PathType Leaf) { $Image = $rawImage }
}
if (-not (Test-Path -LiteralPath $Image -PathType Leaf)) {
    Write-Host ('Image file not found: {0}' -f $Image) -ForegroundColor Yellow
    Write-Host 'Save your click-order CAPTCHA screenshot as an image file first.'
    Write-Host ('For example, save it as: {0}' -f (Join-Path $PSScriptRoot 'raw_data\input.png'))
    Write-Host 'Then rerun this command, or supply the full path to your saved screenshot.'
    Write-Host ''
    Write-Host 'To try the detector now with the included SYNTHETIC example:'
    Write-Host '.\detect.ps1 -Image .\examples\synthetic\case-0.png'
    exit 2
}
$inputFile = (Resolve-Path -LiteralPath $Image).Path
if ($CandidatesOnly) {
    $candidateOutput = Join-Path $Output 'candidate_detection'
    $arguments = @((Join-Path $PSScriptRoot 'candidate_stage.py'), $inputFile, '--output', $candidateOutput)
} else {
    $matcherScript = if ($LegacyMatcher) { 'detect_symbols.py' } else { 'dot_matcher.py' }
    $arguments = @((Join-Path $PSScriptRoot $matcherScript), $inputFile, '--output', $Output, '--count', $Count)
    if ($ReferenceBox) { $arguments += @('--reference-box', $ReferenceBox) }
    if ($SceneBox) { $arguments += @('--scene-box', $SceneBox) }
}
& $pythonExecutable @arguments
exit $LASTEXITCODE


