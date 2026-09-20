@echo off
chcp 65001 > nul
SET "ROOT=%~dp0"
SET "LOG=%ROOT%diagnostico_resultado.txt"

echo ====== Diagnostico del entorno ====== > "%LOG%"
echo Fecha: %DATE% %TIME% >> "%LOG%"
echo. >> "%LOG%"

echo ---- Python del sistema ---- >> "%LOG%"
python --version >> "%LOG%" 2>&1
where python >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- Librerias necesarias para editar la tesis ---- >> "%LOG%"
python -c "import docx; print('python-docx: OK', docx.__version__ if hasattr(docx,'__version__') else '')" >> "%LOG%" 2>&1
python -c "import PIL; print('Pillow: OK', PIL.__version__)" >> "%LOG%" 2>&1
python -c "import matplotlib; print('matplotlib: OK', matplotlib.__version__)" >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- Entorno virtual del backend ---- >> "%LOG%"
if exist "%ROOT%backend\venv\Scripts\python.exe" (
    "%ROOT%backend\venv\Scripts\python.exe" --version >> "%LOG%" 2>&1
    "%ROOT%backend\venv\Scripts\python.exe" -c "import alembic, sqlalchemy, asyncpg; print('alembic, sqlalchemy y asyncpg: OK')" >> "%LOG%" 2>&1
) else (
    echo No existe backend\venv >> "%LOG%"
)
echo. >> "%LOG%"

echo ---- Node y git ---- >> "%LOG%"
node --version >> "%LOG%" 2>&1
git --version >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ---- Conexion a internet ---- >> "%LOG%"
ping -n 2 supabase.com >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ====== FIN ====== >> "%LOG%"

type "%LOG%"
echo.
echo  Resultado guardado en diagnostico_resultado.txt
echo.
pause
