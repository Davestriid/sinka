@echo off
chcp 65001 > nul
SET "ROOT=%~dp0"
SET "LOG=%ROOT%subida_resultado.txt"

cd /d "%ROOT%"

echo ====== Subida a GitHub ====== > "%LOG%"
echo Fecha: %DATE% %TIME% >> "%LOG%"
echo. >> "%LOG%"

echo ---- [0] Limpiar bloqueos sueltos de git ---- >> "%LOG%"
if exist "%ROOT%.git\HEAD.lock" del /f /q "%ROOT%.git\HEAD.lock" >> "%LOG%" 2>&1
if exist "%ROOT%.git\index.lock" del /f /q "%ROOT%.git\index.lock" >> "%LOG%" 2>&1
if exist "%ROOT%.git\objects\maintenance.lock" del /f /q "%ROOT%.git\objects\maintenance.lock" >> "%LOG%" 2>&1
echo   Listo. >> "%LOG%"
echo. >> "%LOG%"

echo ---- [1] Comprobacion de seguridad ---- >> "%LOG%"
git check-ignore -v backend\.env PEGAR_EN_RENDER.txt >> "%LOG%" 2>&1
if errorlevel 1 (
    echo ALTO: algun archivo con claves NO esta ignorado. No se sube nada. >> "%LOG%"
    goto :fin
)
echo   Los archivos con claves estan ignorados. Correcto. >> "%LOG%"
echo. >> "%LOG%"

echo ---- [2] Que queda pendiente ---- >> "%LOG%"
git add -A >> "%LOG%" 2>&1
git status --short >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- [3] Verificar que ningun secreto entro al indice ---- >> "%LOG%"
git diff --cached --name-only | findstr /I /C:".env" /C:"PEGAR_EN_RENDER" > nul
if not errorlevel 1 (
    echo ALTO: hay un archivo de secretos en el indice. Se cancela. >> "%LOG%"
    git reset >> "%LOG%" 2>&1
    goto :fin
)
echo   Ningun archivo de secretos en el indice. Correcto. >> "%LOG%"
echo. >> "%LOG%"

echo ---- [4] Commit de lo que quede suelto ---- >> "%LOG%"
git commit -m "feat: boton Agendar cita desde Vinculos y sube la cuota de solicitudes de amistad de 3 a 5 por dia" >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- [5] Push ---- >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- [6] Estado final ---- >> "%LOG%"
git log --oneline -3 >> "%LOG%" 2>&1
git status -sb >> "%LOG%" 2>&1

:fin
echo. >> "%LOG%"
echo ====== FIN ====== >> "%LOG%"
type "%LOG%"
echo.
pause
