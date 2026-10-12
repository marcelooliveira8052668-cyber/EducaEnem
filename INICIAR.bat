@echo off
title EducaENEM - servidor local
cd /d "%~dp0"

rem Abre o servidor local num terminal proprio. Ele mesmo abre o navegador.
start "" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-servidor.ps1"
