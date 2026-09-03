@echo off
rem Rebuild data.json from local WorkBuddy data. ASCII-only to avoid GBK issues.
rem Python interpreter: set env var WB_PYTHON to a full path (e.g. the WorkBuddy-managed
rem python.exe); when unset, falls back to `python` on PATH. No machine paths hardcoded.
cd /d "%~dp0.."
if defined WB_PYTHON (set "PY=%WB_PYTHON%") else (set "PY=python")
"%PY%" -m backend.pipeline.export_data
echo.
echo data.json refreshed. Reload the browser to see the latest data.
