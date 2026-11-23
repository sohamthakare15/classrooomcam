@echo off
title SmartClassroom AI - Stop All Services
echo ========================================================
echo    SmartClassroom AI Attendance - Shutdown Utility
echo ========================================================

echo [1/3] Terminating backend services on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":8000.*LISTENING"') do (
    echo Killing backend process PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

echo [2/3] Terminating browser dev server on port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":5173.*LISTENING"') do (
    echo Killing Vite dev server PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

echo [3/3] Terminating active Electron instances...
taskkill /f /im electron.exe >nul 2>&1

echo.
echo ========================================================
echo All SmartClassroom processes have been terminated cleanly.
echo ========================================================
ping 127.0.0.1 -n 2 >nul

