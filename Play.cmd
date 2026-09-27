@echo off
rem Starts Custom Arena locally and opens it in your browser. Press Q or close this window to stop.
title Custom Arena
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Custom Arena needs Node.js 22 or newer: https://nodejs.org
  pause
  exit /b 1
)
node scripts/launch.mjs %*
if errorlevel 1 pause
