$ErrorActionPreference = 'Stop'
$pythonPath = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Project Python environment is missing. See README setup instructions.' }
& $pythonPath (Join-Path $PSScriptRoot 'Midasbuy Captcha Solver\engine\bridge.py')
