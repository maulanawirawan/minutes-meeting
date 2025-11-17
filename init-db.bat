@echo off
REM ================================================================
REM naraMEET Database Initialization Script (Windows)
REM ================================================================
REM Purpose: Automatically run database migration
REM Usage: init-db.bat
REM ================================================================

echo.
echo ================================================================
echo   naraMEET Database Migration
echo ================================================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Check if database container is running
docker ps | findstr narameet-db >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Database container 'narameet-db' is not running!
    echo Please run: docker-compose up -d
    pause
    exit /b 1
)

echo [OK] Database container is running
echo.

REM Wait for database to be ready
echo Waiting for database to be ready...
timeout /t 3 /nobreak >nul
echo.

REM Run migration
echo Running migration script...
docker exec -i narameet-db psql -U narameet -d narameet < migration-v2-enhanced.sql

echo.
echo ================================================================
echo   Database Migration Completed Successfully!
echo ================================================================
echo.
echo Default Login Credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo Access URLs:
echo   Frontend: http://localhost:8000
echo   HTTPS:    https://localhost:8443
echo   pgAdmin:  http://localhost:5050
echo   N8N:      http://localhost:5678
echo.
echo TIP: Use HTTPS (port 8443) for recording features!
echo ================================================================
echo.
pause
