@echo off
cd /d "%~dp0"
set PORT=3003
if "%1"=="--fresh" (
  echo Clearing .next cache...
  if exist .next rmdir /s /q .next
  shift
)
if "%1"=="--port" (
  set PORT=%2
  shift
  shift
)
echo Starting Farm App on http://localhost:%PORT%
echo If pages fail with "Cannot find module", stop ALL other dev servers and run: start-dev.cmd --fresh
call npm.cmd run dev -- -p %PORT%
