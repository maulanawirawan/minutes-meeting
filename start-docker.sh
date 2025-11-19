#!/bin/bash
# ================================================================
# naraMEET - Automatic Docker Startup with IP Detection
# ================================================================
# This script automatically detects your network IP
# and starts Docker with the correct configuration
# ================================================================

echo ""
echo "================================================================"
echo "🚀 naraMEET - Automatic Docker Startup"
echo "================================================================"
echo ""

# Detect network IP address (WiFi/Ethernet)
echo "🔍 Detecting your network IP address..."
echo ""

# Try different methods to get IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    HOST_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
else
    # Linux
    HOST_IP=$(hostname -I | awk '{print $1}')
fi

# Check if IP was found
if [ -z "$HOST_IP" ]; then
    echo "❌ Could not detect network IP address!"
    echo ""
    echo "Please check your network connection and try again."
    echo ""
    exit 1
fi

echo "✅ Detected Host IP: $HOST_IP"
echo ""

# Export as environment variable for docker-compose
export HOST_IP=$HOST_IP

echo "🐳 Starting Docker containers with IP: $HOST_IP"
echo ""

# Stop existing containers
echo "📦 Stopping existing containers..."
docker-compose down

echo ""
echo "📦 Building and starting containers..."
docker-compose up -d --build

echo ""
echo "================================================================"
echo "✅ naraMEET is starting!"
echo "================================================================"
echo ""
echo "🌍 Access URLs:"
echo ""
echo "   HTTP:   http://localhost:8000"
echo "   HTTPS:  https://localhost:8443"
echo ""
echo "   Network (WiFi/LAN):"
echo "   HTTP:   http://$HOST_IP:8000"
echo "   HTTPS:  https://$HOST_IP:8443"
echo ""
echo "================================================================"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart"
echo ""
echo "💡 Tip: When you switch WiFi networks, just run this script again!"
echo ""
echo "================================================================"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to start (10 seconds)..."
sleep 10

echo ""
echo "🎉 All done! You can now access naraMEET."
echo ""

# Show logs
echo "📊 Showing Docker logs (press Ctrl+C to exit):"
echo ""
docker-compose logs -f
