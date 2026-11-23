@echo off
title SmartClassroom AI Attendance - Python Backend
cd /d "%~dp0\.."
echo ========================================================
echo    SmartClassroom AI Attendance System - Local Backend
echo ========================================================
echo Starting FastAPI & Computer Vision Engine on port 8000...
python -m ai_engine.api.main
pause

