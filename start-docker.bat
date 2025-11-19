@echo off
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

REM Detect Windows WiFi/Ethernet IP address
echo 🔍 Detecting your network IP address...
echo.

REM Get IPv4 address from active network interface
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP_RAW=%%a
    goto :found_ip
)

:found_ip
REM Trim whitespace
for /f "tokens=* delims= " %%a in ("%IP_RAW%") do set HOST_IP=%%a

REM Check if IP was found
if "%HOST_IP%"=="" (
    echo ❌ Could not detect network IP address!
    echo.
    echo Please check your network connection and try again.
    echo.
    pause
    exit /b 1
)

echo ✅ Detected Host IP: %HOST_IP%
echo.

REM Export as environment variable for docker-compose
set HOST_IP=%HOST_IP%

echo 🐳 Starting Docker containers with IP: %HOST_IP%
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
echo    HTTP:   http://%HOST_IP%:8000
echo    HTTPS:  https://%HOST_IP%:8443
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
