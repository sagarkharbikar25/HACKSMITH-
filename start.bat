@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: BrandGuard AI - One-Click Local Launcher
:: ============================================================================
title BrandGuard AI - Launcher
cd /d "%~dp0"

echo ====================================================================
echo                   Starting BrandGuard AI Platform
echo ====================================================================
echo.

:: ----------------------------------------------------------------------------
:: 1. Detect Python Environment
:: ----------------------------------------------------------------------------
set "PYTHON_EXE="

if exist "%~dp0.venv\Scripts\python.exe" (
    "%~dp0.venv\Scripts\python.exe" -c "import sys" >nul 2>nul
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
    )
)

if not defined PYTHON_EXE (
    where python >nul 2>nul
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
    ) else (
        where py >nul 2>nul
        if !errorlevel! equ 0 (
            set "PYTHON_EXE=py -3"
        )
    )
)

if not defined PYTHON_EXE (
    echo [ERROR] Python was not found in your PATH!
    echo Please install Python 3.11 or newer from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [OK] Using Python: %PYTHON_EXE%

:: ----------------------------------------------------------------------------
:: 2. Detect Node.js & NPM
:: ----------------------------------------------------------------------------
where node >nul 2>nul
if !errorlevel! neq 0 (
    echo [ERROR] Node.js was not found in your PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if !errorlevel! neq 0 (
    echo [ERROR] NPM was not found in your PATH!
    echo Please ensure NPM is installed alongside Node.js.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js and NPM detected.

:: ----------------------------------------------------------------------------
:: 3. Prepare Backend Environment & Dependencies
:: ----------------------------------------------------------------------------
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        echo [INFO] Initializing backend\.env from template...
        copy /y "backend\.env.example" "backend\.env" >nul
    )
)

echo [INFO] Checking Python dependencies...
"%PYTHON_EXE%" -c "import fastapi, uvicorn, sqlalchemy, pgvector" >nul 2>nul
if !errorlevel! neq 0 (
    echo [INFO] Installing required backend packages from backend\requirements.txt...
    "%PYTHON_EXE%" -m pip install -r backend\requirements.txt
    if !errorlevel! neq 0 (
        echo [WARNING] Some Python packages could not be installed automatically.
        echo If you are offline, please connect to the internet and run:
        echo   pip install -r backend\requirements.txt
    )
) else (
    echo [OK] Backend dependencies are satisfied.
)

:: ----------------------------------------------------------------------------
:: 4. Prepare Frontend Dependencies
:: ----------------------------------------------------------------------------
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend npm dependencies - this only happens on first run...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install frontend dependencies with npm install.
        pause
        exit /b 1
    )
) else (
    echo [OK] Frontend dependencies are installed.
)

:: ----------------------------------------------------------------------------
:: 5. Free Occupied Ports (8000 and 5173) if left from previous sessions
:: ----------------------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>nul
if !errorlevel! equ 1 (
    echo [INFO] Freeing occupied ports 8000 and 5173 from earlier sessions...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }" >nul 2>nul
)

:: ----------------------------------------------------------------------------
:: 6. Launch Backend & Frontend Servers in Separate Windows
:: ----------------------------------------------------------------------------
echo.
echo [INFO] Starting Backend API server on http://localhost:8000...
start "BrandGuard AI - Backend" /d "%~dp0backend" cmd /k ""%PYTHON_EXE%" -m uvicorn app.main:app --reload --port 8000"

echo [INFO] Starting Frontend Vite server on http://localhost:5173...
start "BrandGuard AI - Frontend" /d "%~dp0frontend" cmd /k "npm run dev"

:: ----------------------------------------------------------------------------
:: 7. Wait for Servers to Initialize & Automatically Open Browser
:: ----------------------------------------------------------------------------
echo [INFO] Waiting for servers to come online...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready=$false; for($i=0; $i -lt 30; $i++){ try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -eq 200){ $ready=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if(-not $ready){ Start-Sleep -Seconds 2 }" >nul 2>nul

echo.
echo [INFO] Launching BrandGuard AI in your default browser...
start "" "http://localhost:5173"

:: ----------------------------------------------------------------------------
:: 8. Interactive Control Dashboard
:: ----------------------------------------------------------------------------
:menu
cls
echo ====================================================================
echo                    BrandGuard AI is Running!
echo ====================================================================
echo.
echo   * Web Application:   http://localhost:5173
echo   * Backend API:       http://localhost:8000
echo   * API Docs (Swagger):http://localhost:8000/docs
echo   * API Health Check:  http://localhost:8000/api/health
echo.
echo ====================================================================
echo   Quick Demo Personas (Password: demo1234 or 12345678)
echo --------------------------------------------------------------------
echo   - Creator:        creator@lumora.demo  (or saar@test.com)
echo   - Agency:         agency@lumora.demo
echo   - Reviewer:       reviewer@lumora.demo (or ss@test.com)
echo   - Brand Manager:  brand@lumora.demo    (or sk@test.com)
echo   - Admin:          admin@lumora.demo
echo ====================================================================
echo.
echo Controls:
echo   [1] Open Web Application in browser
echo   [2] Open API Documentation (Swagger UI)
echo   [3] Stop all servers and exit
echo.

choice /C 123Q /N /M "Select an action [1, 2, 3, or Q]: "
if errorlevel 4 goto shutdown
if errorlevel 3 goto shutdown
if errorlevel 2 goto open_docs
if errorlevel 1 goto open_browser

:open_browser
start "" "http://localhost:5173"
goto menu

:open_docs
start "" "http://localhost:8000/docs"
goto menu

:shutdown
echo.
echo ====================================================================
echo Stopping BrandGuard AI servers...
echo ====================================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($pids) { foreach ($id in $pids) { try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } catch {} } }" >nul 2>nul
echo [OK] All servers have been stopped.
echo Goodbye!
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1" >nul 2>nul
exit /b 0
