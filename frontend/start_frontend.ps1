# SINKA Frontend - Script de arranque
# Uso: .\start_frontend.ps1 (desde la carpeta frontend/)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host ""
Write-Host "==========================================" -ForegroundColor DarkBlue
Write-Host "  SINKA - Frontend (Next.js 14)           " -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor DarkBlue
Write-Host ""

# 1. Verificar .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "[INFO] No existe .env.local - creando con valores por defecto..." -ForegroundColor Yellow
    "NEXT_PUBLIC_API_URL=http://localhost:8000/api" | Out-File -FilePath ".env.local" -Encoding utf8
}
Write-Host "[OK] .env.local listo" -ForegroundColor Green

# 2. Instalar dependencias si faltan
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Instalando dependencias npm..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "[OK] node_modules presente" -ForegroundColor Green
}

# 3. Arrancar Next.js
Write-Host ""
Write-Host "[INFO] Iniciando frontend en http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Ctrl+C para detener" -ForegroundColor DarkGray
Write-Host ""
npm run dev
