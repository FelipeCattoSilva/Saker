@echo off
setlocal
cd /d "%~dp0"
title Saker - Desenvolvimento
set "ORCA_DEV_USER_DATA_PATH=%APPDATA%\Saker\dev-graph-v0.3"
echo Iniciando o Saker em desenvolvimento...
call npx.cmd --yes pnpm@12.14.0 dev --worktree-profile
if errorlevel 1 (
  echo.
  echo O Saker nao iniciou. Confira os erros acima e execute Preparar Saker.bat se necessario.
  pause
)
