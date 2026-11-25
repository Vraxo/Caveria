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

if not exist "node_modules\.bin\vite.cmd" (
    echo Local Vite installation is missing or incomplete.
    echo Installing locked development dependencies...
    if exist "package-lock.json" (
        call npm ci --include=dev
    ) else (
        call npm install --include=dev
    )
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

echo Launching Vite dev server and opening browser...
call npm run dev -- --open
pause
