@echo off
setlocal enabledelayedexpansion
title SmartClassroom AI Attendance - Desktop Launcher
cd /d "%~dp0"

echo =======================================================================
echo         SmartClassroom AI Attendance System - Desktop Application
echo =======================================================================
echo.

:: 1. Clear any inherited electron node environment variable
set ELECTRON_RUN_AS_NODE=

:: 2. Verify Python runtime
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not available in PATH.
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)

:: 3. Verify Frontend build assets exist
if not exist "desktop\frontend\dist\index.html" (
    echo [SETUP] Production frontend assets not found. Building now...
    call npm --prefix desktop/frontend run build
    if not exist "desktop\frontend\dist\index.html" (
        echo [ERROR] Failed to compile desktop frontend assets.
        pause
        exit /b 1
    )
)

:: 4. Check if backend is already listening on port 8000
netstat -ano | findstr /r ":8000.*LISTENING" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [1/3] Starting Local Python AI Recognition Engine on port 8000...
    start "SmartClassroom Backend Service" cmd /k "python -m ai_engine.api.main"
) else (
    echo [1/3] Python AI Backend is already active on port 8000.
)

:: 5. Health Check Poll Loop (Wait for backend readiness)
echo [2/3] Waiting for AI Recognition Engine to report healthy...
set /a retries=0
:WAIT_LOOP
python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1.5).status == 200 else 1)" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo       [OK] AI Backend confirmed healthy and ready!
    goto LAUNCH_APP
)

set /a retries+=1
if !retries! geq 25 (
    echo.
    echo [ERROR] Timed out waiting for Python backend on http://127.0.0.1:8000/health
    echo Please check the "SmartClassroom Backend Service" terminal window for error details.
    pause
    exit /b 1
)
ping 127.0.0.1 -n 2 >nul
goto WAIT_LOOP

:: 6. Launch Electron Desktop Client
:LAUNCH_APP
echo [3/3] Launching SmartClassroom Electron Desktop Dashboard...
echo.
echo =======================================================================
echo Desktop window is opening. Keep this launcher open or minimize it.
echo To completely stop all services, run STOP_SMARTCLASSROOM.bat
echo =======================================================================
npx electron desktop/electron/main.js

