@echo off
chcp 65001 > nul
SET "LOG=%~dp0pesados_resultado.txt"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$log = '%LOG%';" ^
  "function Peso($r) { if (Test-Path -LiteralPath $r) { $b = (Get-ChildItem -LiteralPath $r -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if (-not $b) { 0 } else { [math]::Round($b/1MB,0) } } else { -1 } };" ^
  "$s = @('====== Donde esta el espacio ======', ('Fecha: ' + (Get-Date)), ('Libre en C: {0} GB' -f [math]::Round((Get-PSDrive C).Free/1GB,2)), '');" ^
  "$objetivos = [ordered]@{" ^
  "  'Papelera de reciclaje'        = 'C:\$Recycle.Bin';" ^
  "  'Descargas'                    = (Join-Path $env:USERPROFILE 'Downloads');" ^
  "  'Docker Desktop (imagenes)'    = (Join-Path $env:LOCALAPPDATA 'Docker');" ^
  "  'Android SDK'                  = (Join-Path $env:LOCALAPPDATA 'Android');" ^
  "  'Android Studio (caches)'      = (Join-Path $env:LOCALAPPDATA 'Google');" ^
  "  'Gradle'                       = (Join-Path $env:USERPROFILE '.gradle');" ^
  "  'Android (.android)'           = (Join-Path $env:USERPROFILE '.android');" ^
  "  'Cache de Chrome'              = (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Cache');" ^
  "  'Cache de Brave'               = (Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\User Data\Default\Cache');" ^
  "  'BlueStacks'                   = (Join-Path $env:PROGRAMDATA 'BlueStacks_nxt');" ^
  "  'Epic Games'                   = 'C:\Program Files\Epic Games';" ^
  "  'Steam'                        = 'C:\Program Files (x86)\Steam';" ^
  "  'Riot / Valorant'              = 'C:\Riot Games';" ^
  "  'Windows.old'                  = 'C:\Windows.old';" ^
  "  'Instalaciones de Windows'     = 'C:\Windows\SoftwareDistribution\Download';" ^
  "  'Documentos'                   = (Join-Path $env:USERPROFILE 'Documents');" ^
  "  'Escritorio'                   = (Join-Path $env:USERPROFILE 'Desktop');" ^
  "};" ^
  "$filas = @();" ^
  "foreach ($k in $objetivos.Keys) { $p = Peso $objetivos[$k]; if ($p -ge 0) { $filas += [pscustomobject]@{ MB = $p; Que = $k } } };" ^
  "foreach ($f in ($filas | Sort-Object MB -Descending)) { $s += ('  {0,8} MB   {1}' -f $f.MB, $f.Que) };" ^
  "$s += '';" ^
  "$s += '---- Carpetas mas grandes dentro de Descargas ----';" ^
  "Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'Downloads') -Force -ErrorAction SilentlyContinue | ForEach-Object { $t = if ($_.PSIsContainer) { Peso $_.FullName } else { [math]::Round($_.Length/1MB,0) }; if ($t -gt 100) { $s += ('  {0,8} MB   {1}' -f $t, $_.Name) } };" ^
  "$s += '';" ^
  "$s += '====== FIN ======';" ^
  "$s | Set-Content -LiteralPath $log -Encoding UTF8;" ^
  "$s | Write-Output"

echo.
pause
