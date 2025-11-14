@echo off
echo =================================
echo MINECRAFT BOT AUTO-RESTART SCRIPT
echo =================================
echo.

:loop
echo [%DATE% %TIME%] Starting Minecraft Bot...
node index.js
echo [%DATE% %TIME%] Bot exited with code: %ERRORLEVEL%
echo [%DATE% %TIME%] Restarting in 10 seconds...
timeout /t 10 /nobreak > nul
goto loop