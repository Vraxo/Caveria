@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Caveria - Starting Dev Server...
echo ========================================

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js / npm was not found in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies for the first time...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo Launching Vite dev server and opening browser...
call npx vite --host 0.0.0.0 --open
pause
