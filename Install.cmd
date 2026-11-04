@echo off
rem Installs or updates Desktop Tools for this Windows user (no admin rights needed).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install.ps1"
echo.
pause
