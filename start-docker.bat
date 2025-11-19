@echo off
setlocal enabledelayedexpansion
REM ================================================================
REM naraMEET - Automatic Docker Startup with IP Detection
REM ================================================================
REM This script automatically detects your Windows network IP
REM and starts Docker with the correct configuration
REM ================================================================

echo.
echo ================================================================
echo 🚀 naraMEET - Automatic Docker Startup
echo ================================================================
echo.

REM Detect Windows WiFi/Ethernet IP address (skip Docker/WSL IPs)
echo 🔍 Detecting your network IP address...
echo.

REM Clear HOST_IP first
set HOST_IP=

REM Loop through all IPv4 addresses and find valid WiFi/Ethernet IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    REM Trim whitespace
    for /f "tokens=* delims= " %%b in ("%%a") do set TEMP_IP=%%b

    REM Check if this IP is NOT a Docker/WSL internal IP
    REM Skip: 172.x.x.x (Docker), 10.0.75.x (WSL), 169.254.x.x (APIPA)
    echo !TEMP_IP! | findstr /r "^172\." >nul
    if !errorlevel! neq 0 (
        echo !TEMP_IP! | findstr /r "^10\.0\.75\." >nul
        if !errorlevel! neq 0 (
            echo !TEMP_IP! | findstr /r "^169\.254\." >nul
            if !errorlevel! neq 0 (
                REM Valid WiFi/Ethernet IP found!
                set HOST_IP=!TEMP_IP!
                echo 🔍 Found candidate IP: !TEMP_IP!
                goto :found_ip
            )
        )
    )
)

:found_ip
REM Check if IP was found
if "!HOST_IP!"=="" (
    echo ❌ Could not detect network IP address!
    echo.
    echo 💡 This might happen if:
    echo    - You're not connected to WiFi/Ethernet
    echo    - All IPs are Docker/WSL internal IPs
    echo.
    echo 🔧 Manual fix: Run this command to see all IPs:
    echo    ipconfig
    echo.
    echo Then set HOST_IP manually:
    echo    set HOST_IP=your.wifi.ip.address
    echo    docker-compose up -d --build
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Detected Host IP: !HOST_IP!
echo    (Skipped Docker/WSL IPs: 172.x.x.x, 10.0.75.x, 169.254.x.x)
echo.

REM Export as environment variable for docker-compose
set HOST_IP=!HOST_IP!

echo 🐳 Starting Docker containers with IP: !HOST_IP!
echo.

REM Stop existing containers
echo 📦 Stopping existing containers...
docker-compose down

echo.
echo 📦 Building and starting containers...
docker-compose up -d --build

echo.
echo ================================================================
echo ✅ naraMEET is starting!
echo ================================================================
echo.
echo 🌍 Access URLs:
echo.
echo    HTTP:   http://localhost:8000
echo    HTTPS:  https://localhost:8443
echo.
echo    Network (WiFi/LAN):
echo    HTTP:   http://!HOST_IP!:8000
echo    HTTPS:  https://!HOST_IP!:8443
echo.
echo ================================================================
echo.
echo 📋 Useful commands:
echo    View logs:    docker-compose logs -f
echo    Stop:         docker-compose down
echo    Restart:      docker-compose restart
echo.
echo 💡 Tip: When you switch WiFi networks, just run this script again!
echo.
echo ================================================================
echo.

REM Wait for services to be ready
echo ⏳ Waiting for services to start (10 seconds)...
timeout /t 10 /nobreak > nul

echo.
echo 🎉 All done! You can now access naraMEET.
echo.

REM Open logs in a new window (optional)
echo 📊 Opening Docker logs...
start cmd /k docker-compose logs -f

pause
