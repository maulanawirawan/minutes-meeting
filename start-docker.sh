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

# Detect network IP address (WiFi/Ethernet), skip Docker/WSL IPs
echo "🔍 Detecting your network IP address..."
echo ""

# Function to check if IP is Docker/WSL internal
is_internal_ip() {
    local ip=$1
    # Skip Docker (172.x.x.x), WSL (10.0.75.x), APIPA (169.254.x.x)
    if [[ $ip =~ ^172\. ]] || [[ $ip =~ ^10\.0\.75\. ]] || [[ $ip =~ ^169\.254\. ]]; then
        return 0  # true (is internal)
    else
        return 1  # false (not internal)
    fi
}

# Try different methods to get IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - try multiple interfaces
    for interface in en0 en1 en2; do
        TEMP_IP=$(ipconfig getifaddr $interface 2>/dev/null)
        if [ -n "$TEMP_IP" ] && ! is_internal_ip "$TEMP_IP"; then
            HOST_IP=$TEMP_IP
            echo "🔍 Found candidate IP on $interface: $TEMP_IP"
            break
        fi
    done
else
    # Linux - get all IPs and filter
    for ip in $(hostname -I); do
        if ! is_internal_ip "$ip"; then
            HOST_IP=$ip
            echo "🔍 Found candidate IP: $ip"
            break
        fi
    done
fi

# Check if IP was found
if [ -z "$HOST_IP" ]; then
    echo "❌ Could not detect network IP address!"
    echo ""
    echo "💡 This might happen if:"
    echo "   - You're not connected to WiFi/Ethernet"
    echo "   - All IPs are Docker/WSL internal IPs"
    echo ""
    echo "🔧 Manual fix: Run this command to see all IPs:"
    echo "   ip addr show  (Linux)"
    echo "   ifconfig      (macOS)"
    echo ""
    echo "Then set HOST_IP manually:"
    echo "   export HOST_IP=your.wifi.ip.address"
    echo "   docker-compose up -d --build"
    echo ""
    exit 1
fi

echo ""
echo "✅ Detected Host IP: $HOST_IP"
echo "   (Skipped Docker/WSL IPs: 172.x.x.x, 10.0.75.x, 169.254.x.x)"
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
