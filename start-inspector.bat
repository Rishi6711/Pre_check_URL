@echo off
title Pre Check URL
cd /d "%~dp0Precheckwebsite"
set PATH=C:\Program Files\nodejs;%PATH%
start http://localhost:4000
"C:\Program Files\nodejs\node.exe" server.js
pause
