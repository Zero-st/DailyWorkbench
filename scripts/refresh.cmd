@echo off
cd /d "%~dp0.."
"C:\Users\lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" -m backend.pipeline.export_data
echo.
echo 已刷新 data.json，刷新浏览器即可看到最新数据。
