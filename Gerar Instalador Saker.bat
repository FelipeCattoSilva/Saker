@echo off
setlocal
cd /d "%~dp0"
title Saker - Gerar instalador Windows
if not exist node_modules\electron\package.json goto missingdeps
if not exist mobile\node_modules\react-native-web\package.json goto missingdeps
where cargo >nul 2>nul
if errorlevel 1 goto missingrust
rem Nao publicar nem procurar certificados locais automaticamente.
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
echo Compilando os auxiliares nativos para Windows...
call npx.cmd --yes pnpm@12.14.0 run build:native
if errorlevel 1 goto failed
echo Validando e gerando o instalador...
call npx.cmd --yes pnpm@12.14.0 run build:win --publish never
if errorlevel 1 goto failed
if not exist dist\saker-windows-setup.exe goto failed
echo.
echo Pronto! Envie somente dist\saker-windows-setup.exe para seus amigos.
explorer.exe "%CD%\dist"
pause
exit /b 0
:missingdeps
echo Execute "Preparar Saker.bat" primeiro.
goto failed
:missingrust
echo Instale Rust com o toolchain MSVC e Visual Studio Build Tools com C++.
:failed
echo.
echo A build falhou. Consulte a mensagem acima e LEIA-ME-Saker.md.
pause
exit /b 1
