@echo off
chcp 65001 > nul
SET "ROOT=%~dp0"
SET "BACKEND=%ROOT%backend"
SET "LOG=%ROOT%migracion_resultado.txt"

echo. > "%LOG%"
echo ====== SINKA - Migraciones de base de datos ====== >> "%LOG%"
echo Fecha: %DATE% %TIME% >> "%LOG%"
echo. >> "%LOG%"

cd /d "%BACKEND%"

if not exist "venv\Scripts\activate.bat" (
    echo ERROR: no existe backend\venv >> "%LOG%"
    goto :fin
)

call venv\Scripts\activate.bat

echo ---- [1] Version aplicada ANTES ---- >> "%LOG%"
alembic current >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- [2] Aplicando migraciones pendientes ---- >> "%LOG%"
alembic upgrade head >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- [3] Version aplicada DESPUES ---- >> "%LOG%"
alembic current >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- [4] Tablas existentes ---- >> "%LOG%"
python "%ROOT%listar_tablas.py" >> "%LOG%" 2>&1

:fin
echo. >> "%LOG%"
echo ====== FIN ====== >> "%LOG%"

type "%LOG%"
echo.
echo  El resultado quedo guardado en migracion_resultado.txt
echo.
pause
