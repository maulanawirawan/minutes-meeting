@echo off
REM ================================================================
REM naraMEET - Ngrok Tunnel for Production Access
REM ================================================================
REM This script starts Ngrok tunnel so naraMEET can be accessed
REM from anywhere in the world!
REM ================================================================

echo.
echo ================================================================
echo 🌐 naraMEET - Starting Production Tunnel
echo ================================================================
echo.

REM Check if Docker is running
echo 🐳 Checking Docker status...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running!
    echo.
    echo Please start Docker Desktop first, then run this script again.
    echo.
    pause
    exit /b 1
)

echo ✅ Docker is running
echo.

REM Start Ngrok tunnel for port 8000 (HTTP)
echo 🚀 Starting Ngrok tunnel for naraMEET...
echo.
echo 📡 Exposing port 8000 to the internet...
echo.
echo ⏳ Please wait, getting your public URL...
echo.

REM Start ngrok (using downloaded path)
"C:\Users\lenovo\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" http 8000

pause
