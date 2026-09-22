@echo off
chcp 65001 > nul
SET "ROOT=%~dp0"
SET "LOG=%ROOT%subida_resultado.txt"

cd /d "%ROOT%"

echo ====== Subida a GitHub ====== > "%LOG%"
echo Fecha: %DATE% %TIME% >> "%LOG%"
echo. >> "%LOG%"

echo ---- [1] Comprobacion de seguridad ---- >> "%LOG%"
git check-ignore -v backend\.env PEGAR_EN_RENDER.txt >> "%LOG%" 2>&1
if errorlevel 1 (
    echo ALTO: algun archivo con claves NO esta ignorado. No se sube nada. >> "%LOG%"
    goto :fin
)
echo   Los archivos con claves estan ignorados. Correcto. >> "%LOG%"
echo. >> "%LOG%"

echo ---- [2] Que va a subir ---- >> "%LOG%"
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

echo ---- [4] Commit ---- >> "%LOG%"
git commit -m "fix: avisar al segundo usuario que su pareja ya esta en la sesion, para que arranque la camara" >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- [5] Push ---- >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- [6] Estado final ---- >> "%LOG%"
git log --oneline -3 >> "%LOG%" 2>&1

:fin
echo. >> "%LOG%"
echo ====== FIN ====== >> "%LOG%"
type "%LOG%"
echo.
pause
