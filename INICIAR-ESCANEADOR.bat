@echo off
chcp 65001 >nul
title Escaneador Profissional
powershell -ExecutionPolicy Bypass -File "%~dp0iniciar-escaneador.ps1"
pause