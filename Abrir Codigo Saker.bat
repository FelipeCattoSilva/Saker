@echo off
setlocal
cd /d "%~dp0"
where code >nul 2>nul
if errorlevel 1 (
  explorer.exe "%CD%"
  exit /b 0
)
call code .
