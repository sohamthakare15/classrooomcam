@echo off
setlocal enabledelayedexpansion
title SmartClassroom AI - Browser Dashboard Launcher
cd /d "%~dp0"

echo =======================================================================
echo          SmartClassroom AI Attendance - Browser Access Portal
echo =======================================================================
echo.

:: 1. Verify Python runtime
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not available in PATH.
    pause
    exit /b 1
)

:: 2. Check & start Backend on port 8000
netstat -ano | findstr /r ":8000.*LISTENING" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [1/3] Starting Local Python AI Recognition Engine on port 8000...
    start "SmartClassroom Backend Service" cmd /k "python -m ai_engine.api.main"
) else (
    echo [1/3] Python AI Backend is already active on port 8000.
)

:: 3. Wait for Backend Health
echo [2/3] Verifying AI Backend health on http://127.0.0.1:8000/health...
set /a retries=0
:WAIT_BACKEND
python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1.5).status == 200 else 1)" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo       [OK] Backend health verified!
    goto START_VITE
)
set /a retries+=1
if !retries! geq 25 (
    echo [ERROR] Backend health check timed out.
    pause
    exit /b 1
)
ping 127.0.0.1 -n 2 >nul
goto WAIT_BACKEND

:: 4. Check & start Vite Dev Server on port 5173
:START_VITE
netstat -ano | findstr /r ":5173.*LISTENING" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [3/3] Starting Vite Web Server on http://localhost:5173...
    start "SmartClassroom Vite Web Dashboard" cmd /k "npm --prefix desktop/frontend run dev"
) else (
    echo [3/3] Vite Web Server is already active on http://localhost:5173.
)

:: 5. Wait for Vite server readiness
set /a viteretries=0
:WAIT_VITE
python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:5173', timeout=1.5).status in [200, 304] else 1)" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    goto OPEN_BROWSER
)
set /a viteretries+=1
if !viteretries! geq 20 (
    goto OPEN_BROWSER
)
ping 127.0.0.1 -n 2 >nul
goto WAIT_VITE

:OPEN_BROWSER
echo.
echo =======================================================================
echo SmartClassroom AI Attendance Dashboard is now live!
echo.
echo    Browser Dashboard:  http://localhost:5173
echo    AI Backend API:     http://127.0.0.1:8000
echo    Health Endpoint:    http://127.0.0.1:8000/health
echo    Live Video Stream:  http://127.0.0.1:8000/camera/stream
echo.
echo Default Faculty Logins:
echo    Teacher Mode:  teacher@school.edu  /  password123
echo    Admin Mode:    admin@school.edu    /  password123
echo =======================================================================
echo.
echo Launching your default web browser...
start http://localhost:5173
echo.
echo Keep the service windows running. To stop all services, run STOP_SMARTCLASSROOM.bat

