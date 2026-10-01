@echo off
rem An online opponent for testing alone: it joins the casual queue, and again after each match. Needs Play.cmd running.
title Custom Arena bot
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Custom Arena needs Node.js 22 or newer: https://nodejs.org
  pause
  exit /b 1
)
node scripts/launch.mjs --bot %*
if errorlevel 1 pause
