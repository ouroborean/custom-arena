@echo off
rem Builds the client and runs it like a release: installable from the browser, works offline. Press Q or close the window to stop.
title Custom Arena (build)
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Custom Arena needs Node.js 22 or newer: https://nodejs.org
  pause
  exit /b 1
)
node scripts/launch.mjs --build %*
if errorlevel 1 pause
