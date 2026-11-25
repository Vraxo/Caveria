@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Caveria - Starting Desktop App...
echo ========================================

where npm >nul 2>nul
if errorlevel 1 goto npm_missing

if exist "node_modules\electron\dist\electron.exe" goto dependencies_ready

echo Desktop dependencies are missing or incomplete.
echo Installing development dependencies without deleting existing modules...
call npm install --include=dev --no-audit --no-fund
if errorlevel 1 goto install_failed
if not exist "node_modules\electron\dist\electron.exe" goto install_failed

:dependencies_ready
echo Building and opening Caveria in a desktop window...
call npm run desktop
if errorlevel 1 goto launch_failed
exit /b 0

:npm_missing
echo [ERROR] Node.js / npm was not found in PATH.
echo Please install Node.js 18+ from https://nodejs.org/
pause
exit /b 1

:install_failed
echo.
echo [ERROR] Dependency installation failed.
echo Close any running Caveria or Vite command windows, then run this launcher again.
echo If the error mentions esbuild.exe, a running dev server or antivirus is locking that file.
pause
exit /b 1

:launch_failed
echo [ERROR] Caveria desktop failed to start.
pause
exit /b 1
