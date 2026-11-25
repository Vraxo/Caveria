@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Caveria - Building Windows Installer
echo ========================================

where npm >nul 2>nul
if errorlevel 1 goto npm_missing

if not exist "node_modules\electron\dist\electron.exe" goto setup_missing
if not exist "node_modules\.bin\electron-builder.cmd" goto setup_missing

echo Building the production game and NSIS installer...
call npm run desktop:build
if errorlevel 1 goto build_failed

for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "CAVERIA_VERSION=%%V"
set "INSTALLER=%CD%\release\Caveria-Setup-%CAVERIA_VERSION%.exe"

if not exist "%INSTALLER%" goto artifact_missing

echo.
echo [SUCCESS] Caveria installer created:
echo %INSTALLER%
echo.
explorer /select,"%INSTALLER%"
pause
exit /b 0

:npm_missing
echo [ERROR] Node.js / npm was not found in PATH.
echo Please install Node.js 18+ from https://nodejs.org/
pause
exit /b 1

:setup_missing
echo [ERROR] Desktop dependencies are not ready yet.
echo Run run-desktop.cmd once, then run this installer builder again.
pause
exit /b 1

:build_failed
echo.
echo [ERROR] Windows installer creation failed.
echo Review the electron-builder error above. The first build may need internet access
echo to download NSIS packaging tools.
pause
exit /b 1

:artifact_missing
echo [ERROR] Packaging completed, but the expected installer was not found:
echo %INSTALLER%
echo Check the release folder for generated artifacts.
explorer "%CD%\release"
pause
exit /b 1
