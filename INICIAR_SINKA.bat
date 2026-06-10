@echo off
SET "ROOT=%~dp0"
SET "BACKEND=%ROOT%backend"
SET "FRONTEND=%ROOT%frontend"

echo.
echo  ==========================================
echo    SINKA - Iniciando Backend y Frontend
echo  ==========================================
echo.

echo [1/2] Abriendo terminal del BACKEND...
start "SINKA Backend" powershell.exe -ExecutionPolicy Bypass -NoExit -Command "Set-Location '%BACKEND%'; .\start_server.ps1"

timeout /t 3 /nobreak > nul

echo [2/2] Abriendo terminal del FRONTEND...
start "SINKA Frontend" powershell.exe -ExecutionPolicy Bypass -NoExit -Command "Set-Location '%FRONTEND%'; .\start_frontend.ps1"

echo.
echo  Listo. Espera ~20 segundos y abre:
echo  http://localhost:3000
echo.
