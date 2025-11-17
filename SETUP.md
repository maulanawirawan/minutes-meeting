# 🚀 naraMEET Setup Guide

Complete setup guide for naraMEET - AI-Powered Meeting Minutes System

---

## 📋 Prerequisites

- Docker Desktop installed and running
- Minimum 8GB RAM
- 10GB free disk space

---

## 🔧 Quick Setup

### 1. Clone and Navigate

```bash
cd CyberMeeting  # or your project folder
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your API keys:

```env
# AssemblyAI Configuration (REQUIRED)
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Jitsi Configuration (OPTIONAL)
JITSI_APP_ID=your_jitsi_app_id
JITSI_KID=your_jitsi_kid
JITSI_PRIVATE_KEY_PATH=./jitsi-private-key.pk

# JWT Secret (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Email Configuration (OPTIONAL)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 3. Start Docker Containers

```bash
docker-compose up -d
```

Wait for all containers to start (about 30-60 seconds).

### 4. Initialize Database

**Windows:**
```bash
init-db.bat
```

**Linux/Mac:**
```bash
chmod +x init-db.sh
./init-db.sh
```

---

## 🌐 Access URLs

### Main Application

- **HTTP**: http://localhost:8000
- **HTTPS**: https://localhost:8443 ⭐ **Use this for recording!**

### Admin Tools

- **pgAdmin** (Database): http://localhost:5050
  - Email: `admin@narameet.com`
  - Password: `admin123`

- **N8N** (Automation): http://localhost:5678
  - Username: `admin`
  - Password: `admin123`

### Access from Mobile/Other Devices

Find your PC's IP address:

**Windows:**
```bash
ipconfig
```
Look for `IPv4 Address` (e.g., 192.168.1.100)

**Linux/Mac:**
```bash
ip addr show
# or
ifconfig
```

Then access from other devices on same WiFi:
- HTTP: `http://192.168.1.100:8000`
- HTTPS: `https://192.168.1.100:8443`

---

## 🔐 Default Login

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Change this password after first login!**

---

## 🎤 Recording Features

### ⚠️ IMPORTANT: HTTPS Required for Recording

Browser security requires **HTTPS** to access microphone/camera.

**✅ Use HTTPS URL:**
```
https://localhost:8443
```

**❌ Recording will NOT work on HTTP:**
```
http://localhost:8000  ← Microphone access blocked!
```

### Certificate Warning

When you first access HTTPS, your browser will show a security warning:

1. Click **Advanced**
2. Click **Proceed to localhost (unsafe)**

This is normal for self-signed certificates in development.

---

## 🛠️ Troubleshooting

### Database Connection Error

If you see "relation does not exist" errors:

```bash
# Re-run migration
docker exec -i narameet-db psql -U narameet -d narameet < migration-v2-enhanced.sql
```

### Container Not Starting

```bash
# Check logs
docker-compose logs backend

# Restart containers
docker-compose restart
```

### Port Already in Use

If ports 8000, 8443, 5432, etc. are already used:

1. Edit `docker-compose.yml`
2. Change port mappings:
   ```yaml
   ports:
     - "9000:3000"  # Use 9000 instead of 8000
   ```

### Recording Error (getUserMedia)

**Problem:** "Cannot read properties of undefined (reading 'getUserMedia')"

**Solution:** Access via HTTPS → `https://localhost:8443`

---

## 🗄️ Database Management

### Connect to Database via pgAdmin

1. Open: http://localhost:5050
2. Login with credentials above
3. Add Server:
   - **Name**: naraMEET
   - **Host**: `narameet-db` (or `postgres`)
   - **Port**: 5432
   - **Database**: `narameet`
   - **Username**: `narameet`
   - **Password**: `narameet123`

### Direct SQL Access

```bash
docker exec -it narameet-db psql -U narameet -d narameet
```

---

## 📊 Features Overview

### ✅ Enabled Features

- ✨ **AssemblyAI Transcription** - Speech-to-text with speaker diarization
- 🤖 **LeMUR AI Summary** - Claude Sonnet 4 powered summaries
- 🎯 **Auto Highlights** - Automatic key point detection
- 😊 **Sentiment Analysis** - Emotion detection per utterance
- 🏷️ **Entity Detection** - Names, dates, locations auto-extracted
- 📖 **Auto Chapters** - Automatic meeting segmentation
- 📄 **Export SRT/VTT** - Subtitle files for videos
- 🔍 **Word Search** - Find specific words with timestamps
- 🎥 **Jitsi Integration** - Built-in video conferencing
- 📧 **Email Notifications** - Auto-send meeting minutes

---

## 🔄 Updating

```bash
# Pull latest changes
git pull

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Re-run migration if needed
init-db.bat  # Windows
./init-db.sh # Linux/Mac
```

---

## 🆘 Support

If you encounter issues:

1. Check Docker logs: `docker-compose logs`
2. Verify all containers are running: `docker-compose ps`
3. Re-run database migration: `init-db.bat` or `./init-db.sh`
4. Restart containers: `docker-compose restart`

---

## 📝 Notes

- **Production Use**: Change all default passwords
- **SSL Certificates**: Generate proper SSL certs for production
- **API Keys**: Keep your AssemblyAI API key secure
- **Backup**: Regularly backup PostgreSQL database

---

**Happy Meeting! 🎉**
