#!/bin/bash
# ================================================================
# naraMEET Database Initialization Script
# ================================================================
# Purpose: Automatically run database migration
# Usage: ./init-db.sh
# ================================================================

set -e

echo "🔄 Starting naraMEET Database Migration..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "   Please start Docker and try again."
    exit 1
fi

# Check if database container is running
if ! docker ps | grep -q narameet-db; then
    echo "❌ Error: Database container 'narameet-db' is not running!"
    echo "   Please run: docker-compose up -d"
    exit 1
fi

echo "✅ Docker is running"
echo "✅ Database container is running"
echo ""

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 3

# Run migration
echo "📦 Running migration script..."
docker exec -i narameet-db psql -U narameet -d narameet < migration-v2-enhanced.sql

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Database Migration Completed Successfully!             ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Default Login Credentials:                                ║"
echo "║    Username: admin                                         ║"
echo "║    Password: admin123                                      ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Access URLs:                                              ║"
echo "║    Frontend: http://localhost:8000                         ║"
echo "║    HTTPS:    https://localhost:8443                        ║"
echo "║    pgAdmin:  http://localhost:5050                         ║"
echo "║    N8N:      http://localhost:5678                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "💡 Tip: Use HTTPS (port 8443) for recording features!"
echo ""
