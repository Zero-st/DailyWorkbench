@echo off
rem Start local workbench server and open browser. ASCII-only to avoid GBK issues.
start "WorkbenchServer" /min /D "%~dp0.." "C:\Users\lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" -m backend.server
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080"
