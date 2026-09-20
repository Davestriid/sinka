@echo off
echo Iniciando servicio Vanguard (vgc)...
sc start vgc
if %errorlevel%==0 (
    echo Servicio vgc iniciado correctamente.
) else (
    echo Intentando con net start...
    net start vgc
)
echo.
echo Listo. Ahora abre Valorant.
pause
