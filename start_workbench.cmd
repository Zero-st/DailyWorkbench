@echo off
rem Start local workbench server and open browser. ASCII-only to avoid GBK issues.
start "WorkbenchServer" /min "C:\Users\lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" "%~dp0server.py"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080"
