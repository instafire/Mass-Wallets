@echo off
title TON Mass Wallet Studio
cd /d "%~dp0"
echo Starting TON Mass Wallet Studio...
start "" /b node server.js --port 5173
timeout /t 2 /nobreak >nul
start http://localhost:5173
