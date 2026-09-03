@echo off
rem Start local workbench server and open browser. ASCII-only to avoid GBK issues.
rem Python interpreter: set env var WB_PYTHON to a full path; when unset, `python` on PATH.
if defined WB_PYTHON (set "PY=%WB_PYTHON%") else (set "PY=python")
start "WorkbenchServer" /min /D "%~dp0.." "%PY%" -m backend.server
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080"
