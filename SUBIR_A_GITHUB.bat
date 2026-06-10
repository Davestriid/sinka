@echo off
SET "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo ==========================================
echo   SINKA - Subir proyecto a GitHub
echo   Repo: github.com/Davestriid/sinka
echo ==========================================
echo.

REM Limpiar git roto si existe
if exist ".git" (
    echo [INFO] Limpiando repositorio git anterior...
    rmdir /s /q .git
)

REM Inicializar git limpio
echo [INFO] Inicializando repositorio...
git init -b main
git config user.email "jdavecalleh@gmail.com"
git config user.name "David"

REM Agregar todos los archivos respetando .gitignore
echo [INFO] Agregando archivos...
git add .

REM Mostrar resumen de lo que se va a subir
echo.
echo [INFO] Archivos que se van a subir:
git status --short
echo.

REM Commit inicial
git commit -m "feat: SINKA v1.0.0 - Full stack (FastAPI + Next.js 14)"

REM Conectar con el repo existente y hacer push forzado
echo [INFO] Conectando con GitHub...
git remote add origin https://github.com/Davestriid/sinka.git

echo [INFO] Subiendo codigo (esto reemplazara el contenido anterior)...
git push --force -u origin main

echo.
echo ==========================================
echo   [OK] Proyecto subido exitosamente!
echo   URL: https://github.com/Davestriid/sinka
echo ==========================================
echo.
pause
