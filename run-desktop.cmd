@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Caveria - Starting Desktop App...
echo ========================================

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js / npm was not found in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
    echo Desktop dependencies are missing or incomplete.
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

echo Building and opening Caveria in a desktop window...
call npm run desktop
if errorlevel 1 (
    echo [ERROR] Caveria desktop failed to start.
    pause
    exit /b 1
)
