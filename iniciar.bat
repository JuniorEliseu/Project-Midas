@echo off
title Projeto Midas
echo ========================================================
echo Iniciando o servidor de desenvolvimento do Projeto Midas...
echo ========================================================
echo.

IF NOT EXIST "node_modules\" (
    echo Instalando dependencias do projeto...
    call npm.cmd install
)

echo Abrindo o navegador...
call npm.cmd run dev -- --open
pause
