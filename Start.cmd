@echo off
rem Starts Desktop Tools (after Install.cmd has run once).
start "" "%~dp0.venv\Scripts\pythonw.exe" -m desktop_tools
