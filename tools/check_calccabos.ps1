$ErrorActionPreference = "Continue"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$log = Join-Path $logDir "healthcheck_$stamp.txt"

function Log($msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path $log -Value $line
}

Log "=== CALCCABOS HEALTHCHECK ==="
Log "Root: $root"

Log "`n--- FRONTEND BUILD ---"
$frontend = Join-Path $root "frontend"
if (Test-Path $frontend) {
    Push-Location $frontend
    npm run build *>> $log
    Log "Frontend build exit code: $LASTEXITCODE"
    Pop-Location
} else {
    Log "Frontend não encontrado."
}

Log "`n--- BACKEND COMPILE ---"
$backend = Join-Path $root "backend"
if (Test-Path $backend) {
    Push-Location $backend
    if (Test-Path "venv\Scripts\python.exe") {
        .\venv\Scripts\python.exe -m compileall app *>> $log
    } else {
        python -m compileall app *>> $log
    }
    Log "Backend compile exit code: $LASTEXITCODE"
    Pop-Location
} else {
    Log "Backend não encontrado."
}

Log "`n--- ROTAS FASTAPI / OPENAPI ---"
try {
    $openapi = Invoke-RestMethod -Uri "http://localhost:8000/openapi.json" -Method GET -TimeoutSec 5
    Log "Backend respondeu em /openapi.json"

    $paths = $openapi.paths.PSObject.Properties.Name
    $wanted = @(
        "/api/projetos/",
        "/api/projetos/{id}/transformador",
        "/api/projetos/{id}/sistema-trifasico",
        "/api/projetos/{id}/protecoes",
        "/api/projetos/{id}/para-raios",
        "/api/projetos/{id}/aterramento",
        "/api/projetos/{id}/areas-classificadas",
        "/api/circuitos/projeto/{projeto_id}",
        "/api/circuitos/calcular-lote/{projeto_id}",
        "/api/relatorios/{projeto_id}/pdf",
        "/api/relatorios/{projeto_id}/excel",
        "/api/agente/chat"
    )

    foreach ($route in $wanted) {
        if ($paths -contains $route) {
            Log "OK rota existe: $route"
        } else {
            Log "FALTA rota: $route"
        }
    }
} catch {
    Log "Não foi possível acessar http://localhost:8000/openapi.json"
    Log $_
}

Log "`nRelatório salvo em: $log"