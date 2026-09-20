@echo off
echo ==========================================
echo   Arreglando error VAN-79 de Valorant
echo ==========================================
echo.

echo [1/5] Cerrando procesos de Riot y Vanguard...
taskkill /f /im "VALORANT-Win64-Shipping.exe" 2>nul
taskkill /f /im "RiotClientServices.exe" 2>nul
taskkill /f /im "vgc.exe" 2>nul
taskkill /f /im "vgtray.exe" 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Reiniciando servicio Vanguard (vgc)...
sc stop vgc 2>nul
timeout /t 2 /nobreak >nul
sc start vgc
timeout /t 3 /nobreak >nul

echo [3/5] Limpiando DNS...
ipconfig /flushdns

echo [4/5] Reseteando Winsock...
netsh winsock reset

echo [5/5] Reiniciando adaptadores de red...
netsh int ip reset

echo.
echo ==========================================
echo  Listo. Ahora REINICIA tu computadora
echo  y luego abre Valorant.
echo ==========================================
echo.
pause
