@echo off
chcp 65001 > nul
SET "ROOT=%~dp0"
SET "LOG=%ROOT%secretos_resultado.txt"

cd /d "%ROOT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$log = '%LOG%'; $s = @();" ^
  "$s += '====== Revision de secretos en el historial ======';" ^
  "$s += ('Fecha: ' + (Get-Date)); $s += '';" ^
  "$patrones = 'postgresql\+asyncpg://postgres','rediss://default:','JWT_SECRET=[0-9a-f]{32}','pooler\.supabase\.com','upstash\.io:6379','EQwrZZFhXXD6VNHX','28jdch2005';" ^
  "$commits = git rev-list --all;" ^
  "$s += ('Commits revisados: ' + $commits.Count); $s += '';" ^
  "$s += '---- Coincidencias en el contenido de cualquier commit ----';" ^
  "$hallazgos = 0;" ^
  "foreach ($p in $patrones) {" ^
  "  $r = git grep -I -n -E $p $commits 2>$null;" ^
  "  if ($r) { $hallazgos++; $s += ('  ENCONTRADO -> ' + $p); $s += ($r | Select-Object -First 3 | ForEach-Object { '     ' + $_ }) }" ^
  "};" ^
  "if ($hallazgos -eq 0) { $s += '  Ninguna coincidencia. El historial esta limpio.' };" ^
  "$s += '';" ^
  "$s += '---- Contenido de los .env.example (deben ser plantillas) ----';" ^
  "foreach ($f in 'backend/.env.example','frontend/.env.local.example') { if (Test-Path $f) { $s += ('  --- ' + $f); $s += (Get-Content $f | Where-Object { $_ -match '=' } | ForEach-Object { '     ' + $_ }) } };" ^
  "$s += '';" ^
  "$s += ('Archivos en el repositorio: ' + (git ls-files).Count);" ^
  "$s += '====== FIN ======';" ^
  "$s | Set-Content -LiteralPath $log -Encoding UTF8;" ^
  "$s | Write-Output"

echo.
pause
