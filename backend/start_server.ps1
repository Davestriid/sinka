# SINKA Backend - Script de arranque
# Uso: .\start_server.ps1 (desde la carpeta backend/)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host ""
Write-Host "==========================================" -ForegroundColor DarkGreen
Write-Host "  SINKA - Backend (FastAPI + Uvicorn)     " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor DarkGreen
Write-Host ""

# 1. Verificar que existe .env
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] No se encontro .env en $Root" -ForegroundColor Red
    Write-Host "  Copia .env.example -> .env y completa los valores." -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host "[OK] .env encontrado" -ForegroundColor Green

# 2. Entorno virtual
if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "[INFO] Creando entorno virtual..." -ForegroundColor Cyan
    python -m venv venv
}
Write-Host "[OK] Activando entorno virtual..." -ForegroundColor Green
cmd /c "venv\Scripts\activate.bat && echo Venv activado"
$env:VIRTUAL_ENV = "$Root\venv"
$env:PATH = "$Root\venv\Scripts;$env:PATH"

# 3. Instalar / actualizar dependencias
Write-Host "[INFO] Instalando dependencias..." -ForegroundColor Cyan
pip install -r requirements.txt --quiet
Write-Host "[OK] Dependencias listas" -ForegroundColor Green

# 4. Aplicar migraciones Alembic
Write-Host ""
Write-Host "[INFO] Aplicando migraciones Alembic..." -ForegroundColor Cyan
python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Fallo alembic upgrade head." -ForegroundColor Red
    Write-Host "  Verifica DATABASE_URL en .env" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host "[OK] Base de datos al dia" -ForegroundColor Green

# 5. Arrancar Uvicorn
Write-Host ""
Write-Host "[INFO] Iniciando servidor en http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Docs: http://localhost:8000/api/docs" -ForegroundColor DarkCyan
Write-Host "  Health: http://localhost:8000/api/health" -ForegroundColor DarkCyan
Write-Host "  Ctrl+C para detener" -ForegroundColor DarkGray
Write-Host ""
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
