@echo off
rem Double-click to start Localtone from this source folder.
setlocal
cd /d "%~dp0"
title Localtone

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 LTS from https://nodejs.org and try again.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Using Node.js %%v

rem Install dependencies on the first run, or if Electron is missing.
if exist "node_modules\electron\dist\electron.exe" goto run
echo Installing dependencies - first run only, this can take a few minutes...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed. See the messages above.
  pause
  exit /b 1
)

:run
echo Starting Localtone. Keep this window open while the app runs.
call npm start
if errorlevel 1 (
  echo.
  echo Localtone exited with an error. See the messages above.
  pause
)
endlocal
