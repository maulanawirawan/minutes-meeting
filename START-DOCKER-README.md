# 🚀 naraMEET - Automatic Docker Startup

## 📋 Overview

This project includes **automatic IP detection scripts** that make it easy to run naraMEET on different WiFi networks without manual configuration!

### ✨ Features

- **100% Automatic**: No need to manually edit configuration files
- **Network Switching**: Switch between WiFi networks (home, office, café) seamlessly
- **One-Click Startup**: Just run the script and everything is configured automatically
- **Cross-Platform**: Works on Windows, Linux, and macOS

---

## 🖥️ Windows Users

### 📂 Script: `start-docker.bat`

### 🎯 How to Use

1. **Open Command Prompt** (CMD) or PowerShell in the project directory:
   ```cmd
   cd C:\Users\lenovo\Downloads\CyberMeeting
   ```

2. **Run the startup script**:
   ```cmd
   start-docker.bat
   ```

3. **That's it!** The script will:
   - ✅ Automatically detect your Windows network IP
   - ✅ Stop any existing Docker containers
   - ✅ Build and start fresh containers
   - ✅ Display access URLs with your actual IP address
   - ✅ Open Docker logs automatically

### 📱 Sample Output

```
================================================================
🚀 naraMEET - Automatic Docker Startup
================================================================

🔍 Detecting your network IP address...

✅ Detected Host IP: 192.168.100.248

🐳 Starting Docker containers with IP: 192.168.100.248

📦 Stopping existing containers...
📦 Building and starting containers...

================================================================
✅ naraMEET is starting!
================================================================

🌍 Access URLs:

   HTTP:   http://localhost:8000
   HTTPS:  https://localhost:8443

   Network (WiFi/LAN):
   HTTP:   http://192.168.100.248:8000
   HTTPS:  https://192.168.100.248:8443

================================================================
```

### 🔄 When You Switch Networks

**Scenario**: You take your laptop from **home** to **office** (different WiFi)

**Solution**: Just run the script again!

```cmd
start-docker.bat
```

The script will:
1. Detect your new IP address (e.g., from `192.168.100.248` to `192.168.1.50`)
2. Restart Docker with the new configuration
3. Display the correct URLs for your new network

**No manual editing required!** 🎉

---

## 🐧 Linux / 🍎 macOS Users

### 📂 Script: `start-docker.sh`

### 🎯 How to Use

1. **Open Terminal** in the project directory:
   ```bash
   cd /path/to/minutes-meeting
   ```

2. **Make script executable** (first time only):
   ```bash
   chmod +x start-docker.sh
   ```

3. **Run the startup script**:
   ```bash
   ./start-docker.sh
   ```

4. **That's it!** The script will automatically detect your network IP and start Docker.

### 📱 Sample Output

```
================================================================
🚀 naraMEET - Automatic Docker Startup
================================================================

🔍 Detecting your network IP address...

✅ Detected Host IP: 192.168.1.100

🐳 Starting Docker containers with IP: 192.168.1.100

📦 Stopping existing containers...
📦 Building and starting containers...

================================================================
✅ naraMEET is starting!
================================================================

🌍 Access URLs:

   HTTP:   http://localhost:8000
   HTTPS:  https://localhost:8443

   Network (WiFi/LAN):
   HTTP:   http://192.168.1.100:8000
   HTTPS:  https://192.168.1.100:8443

================================================================

📊 Showing Docker logs (press Ctrl+C to exit):
```

---

## 🌐 Port Information

### External Access (from other devices)

| Service | Protocol | Port | URL Example |
|---------|----------|------|-------------|
| **Web App (HTTP)** | HTTP | `8000` | `http://192.168.100.248:8000` |
| **Web App (HTTPS)** | HTTPS | `8443` | `https://192.168.100.248:8443` |
| **PostgreSQL** | TCP | `5432` | `192.168.100.248:5432` |
| **Redis** | TCP | `6379` | `192.168.100.248:6379` |
| **N8N Automation** | HTTP | `5678` | `http://192.168.100.248:5678` |
| **pgAdmin** | HTTP | `5050` | `http://192.168.100.248:5050` |

### Local Access (from your laptop)

| Service | URL |
|---------|-----|
| **Web App (HTTP)** | `http://localhost:8000` |
| **Web App (HTTPS)** | `https://localhost:8443` |
| **N8N** | `http://localhost:5678` |
| **pgAdmin** | `http://localhost:5050` |

---

## 📱 Mobile Access

### Accessing from Your Phone/Tablet

1. **Connect your phone to the same WiFi** as your laptop
2. **Open browser** on your phone
3. **Enter the Network URL** shown in the startup output:
   ```
   http://192.168.100.248:8000
   ```

4. For microphone/camera features, use HTTPS:
   ```
   https://192.168.100.248:8443
   ```

   > ⚠️ **Note**: You'll see a certificate warning. Click **"Advanced"** → **"Proceed anyway"**

---

## 🔧 Troubleshooting

### ❌ Problem: "Could not detect network IP address"

**Cause**: Not connected to WiFi/LAN

**Solution**:
1. Connect to WiFi
2. Run the script again

---

### ❌ Problem: Can't access from phone/other device

**Causes & Solutions**:

1. **Different WiFi Network**
   - ✅ Make sure your phone and laptop are on the **same WiFi**

2. **Firewall Blocking**
   - ✅ Windows: Allow Docker through firewall
   - ✅ Check Windows Defender settings

3. **Wrong URL**
   - ✅ Use the **Network URL** shown in startup output
   - ✅ Don't use `localhost` from other devices

---

### ❌ Problem: Docker not starting

**Solution**:
1. Make sure Docker Desktop is running
2. Check if ports are already in use:
   ```cmd
   netstat -ano | findstr :8000
   ```
3. Stop conflicting services or change ports in `docker-compose.yml`

---

## 🎯 Quick Command Reference

### Windows

```cmd
# Start naraMEET with auto IP detection
start-docker.bat

# View logs only
docker-compose logs -f

# Stop containers
docker-compose down

# Restart containers (without rebuild)
docker-compose restart
```

### Linux / macOS

```bash
# Start naraMEET with auto IP detection
./start-docker.sh

# View logs only
docker-compose logs -f

# Stop containers
docker-compose down

# Restart containers (without rebuild)
docker-compose restart
```

---

## 💡 Pro Tips

### 1. **Bookmarks for Different Networks**

Create browser bookmarks for each location:

- 🏠 **Home**: `http://192.168.100.248:8000`
- 🏢 **Office**: `http://192.168.1.50:8000`
- ☕ **Café**: `http://10.0.0.25:8000`

After running the startup script, just use the bookmark for your current location!

### 2. **Share with Colleagues**

When in a meeting, share the Network URL with participants:

```
📱 Join meeting at: http://192.168.1.50:8000
```

They can access it from their devices if on the same WiFi!

### 3. **Always Use HTTPS for Meetings**

For Jitsi video calls (microphone/camera), always use HTTPS:

```
https://YOUR_IP:8443
```

Browsers require HTTPS for microphone/camera permissions.

---

## 🔐 Security Notes

### Self-Signed Certificate Warning

When using HTTPS (`https://IP:8443`), you'll see a security warning because the SSL certificate is self-signed.

**This is SAFE for local development!**

**How to proceed**:
1. Click **"Advanced"** or **"Show details"**
2. Click **"Proceed to [IP] (unsafe)"** or **"Accept the risk"**

### Production Deployment

For production, use a real SSL certificate from:
- Let's Encrypt (free)
- Cloudflare
- Your domain provider

---

## 🚀 What Happens Behind the Scenes

### Windows (`start-docker.bat`)

```batch
1. Detects your WiFi IP using `ipconfig`
2. Exports as environment variable: HOST_IP=192.168.100.248
3. Passes to docker-compose
4. Docker containers use this IP
5. server.js reads HOST_IP and displays correct URLs
```

### Linux/macOS (`start-docker.sh`)

```bash
1. Detects your network IP using `hostname -I` or `ipconfig getifaddr`
2. Exports as environment variable: HOST_IP=192.168.1.100
3. Passes to docker-compose
4. Docker containers use this IP
5. server.js reads HOST_IP and displays correct URLs
```

---

## 📚 Related Documentation

- [NEW-FEATURES-DOCS.md](./NEW-FEATURES-DOCS.md) - AssemblyAI Streaming API, Speaker ID, Translation
- [ASSEMBLYAI-FEATURES.md](./ASSEMBLYAI-FEATURES.md) - Complete AssemblyAI integration guide
- [docker-compose.yml](./docker-compose.yml) - Docker configuration

---

## 🎉 Summary

### ✅ Before (Manual)

```
1. Open ipconfig
2. Find IP address
3. Edit configuration files
4. Run docker-compose up
5. Manually type URLs
```

### ✅ After (Automatic)

```
1. Run start-docker.bat
2. Copy URL from output
3. Done! 🎉
```

**100x easier!** No more manual IP hunting when switching networks! 🚀

---

**Made with ❤️ for naraMEET v2.0 ULTIMATE**
