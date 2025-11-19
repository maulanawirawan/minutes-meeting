@echo off
REM ================================================================
REM naraMEET - Dual Ngrok Tunnel (Port 8000 + 8443)
REM ================================================================
REM This script starts TWO Ngrok tunnels:
REM 1. Port 8000 (HTTP/API)
REM 2. Port 8443 (HTTPS/SSL for microphone/camera)
REM ================================================================

echo.
echo ================================================================
echo 🌐 naraMEET - Starting Dual Production Tunnels
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

echo 🚀 Starting Ngrok tunnels...
echo.
echo 📡 This will open 2 tunnels:
echo    1. Port 8000 (HTTP/API)
echo    2. Port 8443 (HTTPS/SSL)
echo.
echo ⏳ Please wait...
echo.

REM Start Ngrok with BOTH ports using config file
"C:\Users\lenovo\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" start --all --config=ngrok.yml

pause
