@echo off
title SmartClassroom AI Attendance - Environment Setup
cd /d "%~dp0\.."
echo ========================================================
echo    SmartClassroom AI Attendance - Environment Setup
echo ========================================================

echo [1/4] Installing Python requirements...
python -m pip install -r requirements.txt

echo [2/4] Downloading OpenCV Zoo AI Models (YuNet & SFace)...
python scripts/download_models.py

echo [3/4] Installing Root & Frontend Dependencies...
npm install
npm --prefix desktop/frontend install

echo [4/4] Building Production Desktop Frontend Assets...
npm --prefix desktop/frontend run build

echo.
echo ========================================================
echo Setup complete! Run scripts\run_all.bat to launch app.
echo ========================================================
pause

