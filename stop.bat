@echo off
setlocal
title Brandora AI - Stop Services

echo ====================================================================
echo                   Stopping Brandora AI Services
echo ====================================================================
echo.
echo Terminating processes listening on ports 8000 (Backend) and 5173 (Frontend)...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($pids) { foreach ($id in $pids) { try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Host ('[OK] Stopped process ' + $id) } catch {} } } else { Write-Host '[INFO] No running services found on port 8000 or 5173.' }"

echo.
echo [OK] Done!
echo ====================================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2" >nul 2>nul
exit /b 0
