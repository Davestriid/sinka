@echo off
chcp 65001 > nul
SET "ROOT=%~dp0"
SET "SALIDA=%ROOT%PEGAR_EN_RENDER.txt"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$archivo = Join-Path '%ROOT%' 'backend\.env';" ^
  "if (-not (Test-Path -LiteralPath $archivo)) { 'No se encontro backend\.env' | Set-Content -LiteralPath '%SALIDA%'; exit };" ^
  "$lineas = Get-Content -LiteralPath $archivo;" ^
  "function Valor($clave) { $m = $lineas | Where-Object { $_ -match ('^' + $clave + '=') } | Select-Object -First 1; if ($m) { $m.Substring($clave.Length + 1) } else { '' } };" ^
  "$salida = @();" ^
  "$salida += 'APP_ENV=production';" ^
  "$salida += 'APP_TITLE=SINKA API';" ^
  "$salida += 'APP_VERSION=1.0.0';" ^
  "$salida += 'JWT_ALGORITHM=HS256';" ^
  "$salida += 'JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30';" ^
  "$salida += 'JWT_REFRESH_TOKEN_EXPIRE_DAYS=7';" ^
  "$salida += 'CORS_ORIGINS=https://sinka-eight.vercel.app';" ^
  "$salida += ('DATABASE_URL=' + (Valor 'DATABASE_URL'));" ^
  "$salida += ('JWT_SECRET=' + (Valor 'JWT_SECRET'));" ^
  "$salida += ('REDIS_URL=' + (Valor 'REDIS_URL'));" ^
  "$salida | Set-Content -LiteralPath '%SALIDA%' -Encoding UTF8;" ^
  "Set-Clipboard -Value ($salida -join [Environment]::NewLine);" ^
  "Write-Output ('Generadas ' + $salida.Count + ' variables. Copiadas al portapapeles.')"

echo.
echo  Archivo listo: PEGAR_EN_RENDER.txt
timeout /t 4 > nul
