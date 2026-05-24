@echo off
echo ========================================
echo   Park Manor - Local Dev Server
echo ========================================
echo.

:: Move to the folder where dev.bat lives
cd /d "%~dp0"

:: Create public folder and move index.html if needed
if exist "index.html" (
    if not exist "public" mkdir "public"
    echo [OK] Moving index.html into public\ folder...
    move /Y "index.html" "public\index.html" >nul
)

:: Create attachments folder
if not exist "public\park_manor_attachments" (
    mkdir "public\park_manor_attachments"
    echo [OK] Created park_manor_attachments folder
)

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install from https://python.org
    pause
    exit /b 1
)

echo [OK] Starting server on http://localhost:8080
echo [OK] Files saved to: %~dp0public\park_manor_attachments\
echo [OK] Press Ctrl+C to stop
echo.

:: Open browser after 2 seconds
start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:8080"

:: Run the custom server (handles file uploads)
python server.py
pause
