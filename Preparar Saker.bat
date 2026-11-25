@echo off
setlocal
cd /d "%~dp0"
title Saker - Preparar ambiente
set "TrackFileAccess=false"
where node >nul 2>nul
if errorlevel 1 goto missingnode
node -e "process.exit(Number(process.versions.node.split('.')[0]) === 24 ? 0 : 1)"
if errorlevel 1 goto missingnode
where git >nul 2>nul
if errorlevel 1 goto missinggit
echo Instalando dependencias da IDE com o lockfile...
call npx.cmd --yes pnpm@12.14.0 install --frozen-lockfile
if errorlevel 1 goto failed
echo Instalando dependencias do cliente mobile incluido no aplicativo...
call npx.cmd --yes pnpm@12.14.0 -C mobile install --frozen-lockfile
if errorlevel 1 goto failed
echo.
echo Ambiente preparado. Abra "Iniciar Saker Dev.bat" para editar e testar.
pause
exit /b 0
:missingnode
echo Instale o Node.js 24 e abra este arquivo novamente.
goto failed
:missinggit
echo Instale o Git para Windows e abra este arquivo novamente.
:failed
echo.
echo A preparacao falhou. Consulte LEIA-ME-Saker.md e a mensagem acima.
pause
exit /b 1
