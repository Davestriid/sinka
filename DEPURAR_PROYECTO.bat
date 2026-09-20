@echo off
chcp 65001 > nul
SET "ROOT=%~dp0"
SET "LOG=%ROOT%depuracion_resultado.txt"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$raiz = '%ROOT%'; $log = '%LOG%';" ^
  "function Peso($r) { if (Test-Path -LiteralPath $r) { $b = (Get-ChildItem -LiteralPath $r -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if (-not $b) { 0 } else { [math]::Round($b/1MB,1) } } else { -1 } };" ^
  "$s = @('====== Depuracion del proyecto SINKA ======', ('Fecha: ' + (Get-Date)), '');" ^
  "$s += ('Libre en C: antes: {0} GB' -f [math]::Round((Get-PSDrive C).Free/1GB,2));" ^
  "$s += '';" ^
  "$nm = Join-Path $raiz 'frontend\node_modules';" ^
  "$antes = Peso $nm;" ^
  "if ($antes -ge 0) {" ^
  "  $s += ('---- frontend\node_modules ({0} MB) ----' -f $antes);" ^
  "  Remove-Item -LiteralPath $nm -Recurse -Force -ErrorAction SilentlyContinue;" ^
  "  if (Test-Path -LiteralPath $nm) { $s += '  NO se pudo borrar del todo. Cierra VS Code o cualquier terminal abierta en el proyecto.' } else { $s += '  Eliminado. Se recupera con: npm install' }" ^
  "} else { $s += '---- frontend\node_modules: no existe ----' };" ^
  "$s += '';" ^
  "$s += '---- Lo que se conserva ----';" ^
  "foreach ($c in 'backend','frontend\src','frontend\package.json','_versiones_anteriores','.git') { $p = Peso (Join-Path $raiz $c); if ($p -ge 0) { $s += ('  {0,8} MB  {1}' -f $p, $c) } };" ^
  "$s += '';" ^
  "$s += ('Peso total del proyecto ahora: {0} MB' -f (Peso $raiz));" ^
  "$s += ('Libre en C: despues: {0} GB' -f [math]::Round((Get-PSDrive C).Free/1GB,2));" ^
  "$s += '====== FIN ======';" ^
  "$s | Set-Content -LiteralPath $log -Encoding UTF8;" ^
  "$s | Write-Output"

echo.
pause
