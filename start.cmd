@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js 18 oder neuer wird benoetigt.
  echo   Download: https://nodejs.org
  echo.
  pause
  exit /b 1
)
node server.mjs %*
if errorlevel 1 pause
