@echo off
cd /d "%~dp0"
if exist "release\0.5.0\QuickTone Preset Studio-win32-x64\QuickTone Preset Studio.exe" (
  start "" "release\0.5.0\QuickTone Preset Studio-win32-x64\QuickTone Preset Studio.exe"
  exit /b 0
)
where node >nul 2>nul
if errorlevel 1 (
  echo Descarga el ZIP de Releases, o instala Node.js 22.12+ y ejecuta npm ci.
  pause
  exit /b 1
)
npm start
pause
