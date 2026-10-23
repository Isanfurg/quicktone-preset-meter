@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 20 o superior y vuelve a abrir este archivo.
  pause
  exit /b 1
)
echo Abre http://127.0.0.1:8787 en Chrome o Edge.
node server.mjs
pause
