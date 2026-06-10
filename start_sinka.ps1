# ── SINKA — Arranque completo (backend + frontend) ─────────────────────────
# Ejecutar desde la RAÍZ del proyecto: .\start_sinka.ps1
# Abre DOS terminales: una para el backend y otra para el frontend.
# ────────────────────────────────────────────────────────────────────────────

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          SINKA — Full Stack           ║" -ForegroundColor Cyan
Write-Host "║  Backend:  http://localhost:8000      ║" -ForegroundColor Cyan
Write-Host "║  Frontend: http://localhost:3000      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Abrir backend en nueva ventana PowerShell
Write-Host "[1/2] Abriendo terminal del backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\backend'; .\start_server.ps1"

Start-Sleep -Seconds 2

# Abrir frontend en nueva ventana PowerShell
Write-Host "[2/2] Abriendo terminal del frontend..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend'; .\start_frontend.ps1"

Write-Host ""
Write-Host "Las dos terminales están en marcha." -ForegroundColor Cyan
Write-Host "Espera ~15s y abre http://localhost:3000 en tu navegador." -ForegroundColor White
Write-Host ""
