@echo off
title SmartClassroom AI Attendance - Desktop App
cd /d "%~dp0\.."
echo ========================================================
echo    SmartClassroom AI Attendance System - Desktop Client
echo ========================================================

:: Clear any inherited electron node mode
set ELECTRON_RUN_AS_NODE=

echo Launching Electron desktop interface...
npx electron desktop/electron/main.js
pause
