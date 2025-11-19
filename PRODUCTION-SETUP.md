# 🚀 naraMEET Production Setup Guide

## 📋 Quick Start - Command Lengkap

Berikut adalah **semua command** yang perlu Anda jalankan di VS Code Terminal.

---

## 🔄 SETIAP KALI IDUPIN LAPTOP / GANTI WIFI

### Step 1: Buka VS Code Terminal

Tekan `Ctrl + ~` atau **Terminal → New Terminal**

### Step 2: Jalankan Docker dengan IP Auto-Detect

```cmd
start-docker.bat
```

**Output yang muncul:**
```
🚀 naraMEET - Automatic Docker Startup
🔍 Detecting your network IP address...
✅ Detected Host IP: 192.168.100.248
   (Skipped Docker/WSL IPs: 172.x.x.x, 10.0.75.x, 169.254.x.x)

🐳 Starting Docker containers with IP: 192.168.100.248

🌍 Access URLs:
   HTTP:   http://localhost:8000
   HTTPS:  https://localhost:8443

   Network (WiFi/LAN):
   HTTP:   http://192.168.100.248:8000
   HTTPS:  https://192.168.100.248:8443
```

### Step 3: Start Production URL (Bisa Diakses dari Mana Saja!)

**Buka Command Prompt BARU** (jangan di VS Code Terminal, karena akan block):

```cmd
cd C:\Users\lenovo\Downloads\CyberMeeting
start-ngrok.bat
```

**Output:**
```
ngrok

Session Status                online
Account                       your-email@gmail.com
Version                       3.x.x
Region                        Asia Pacific (ap)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc-123-def.ngrok-free.app -> http://localhost:8000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**COPY URL INI:** `https://abc-123-def.ngrok-free.app`

**Share ke siapa saja!** Mereka bisa buka dari HP, laptop, di mana saja! 🌍

---

## 🆕 SETUP AWAL (SEKALI SAJA)

### 1. Install Ngrok

**Download:**
```
https://ngrok.com/download
```

- Pilih **Windows**
- Download ZIP
- Extract ke `C:\ngrok`

**Signup & Get Token:**
```
https://dashboard.ngrok.com/signup
```

- Signup gratis
- Copy **Auth Token** dari dashboard

**Setup Token:**

Buka Command Prompt:
```cmd
cd C:\ngrok
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

Ganti `YOUR_AUTH_TOKEN_HERE` dengan token Anda.

**SELESAI!** Setup ini cukup sekali saja.

---

## 📱 CARA AKSES

### Akses Lokal (Dari Laptop Anda)

```
http://localhost:8000
https://localhost:8443
```

### Akses Network (Dari HP/Device di WiFi yang Sama)

```
http://192.168.100.248:8000
https://192.168.100.248:8443
```

(IP akan otomatis berubah sesuai WiFi)

### Akses Production (Dari Mana Saja di Dunia!)

```
https://abc-123-def.ngrok-free.app
```

(URL dari Ngrok, share ini ke siapa saja!)

---

## 🔧 TROUBLESHOOTING

### ❌ Docker Tidak Jalan

**Error:**
```
Cannot connect to Docker daemon
```

**Solusi:**
1. Buka **Docker Desktop**
2. Tunggu sampai status "Running"
3. Jalankan ulang `start-docker.bat`

---

### ❌ Ngrok Error: "command not found"

**Error:**
```
'ngrok' is not recognized as an internal or external command
```

**Solusi:**
1. Pastikan sudah extract `ngrok.exe` ke `C:\ngrok`
2. Atau ubah path di `start-ngrok.bat`:
   ```batch
   cd C:\path\to\your\ngrok\folder
   ```

---

### ❌ Ngrok URL Berubah Setiap Restart

**Ini NORMAL!** Ngrok free tier akan kasih URL baru setiap restart.

**Solusi:**
- **Opsi 1:** Upgrade Ngrok ke paid ($8/month) untuk fixed domain
- **Opsi 2:** Pakai Cloudflare Tunnel (gratis, permanent URL)

**Setup Cloudflare Tunnel (Alternative):**

```cmd
# Download cloudflared
https://github.com/cloudflare/cloudflared/releases/latest

# Login
cloudflared tunnel login

# Run tunnel
cloudflared tunnel --url http://localhost:8000
```

URL akan permanent dan gratis!

---

### ❌ Sentiment & Entities Kosong

**Problem:** Tab "😊 SENTIMENT" dan "🔍 ANALYSIS" kosong.

**Solusi:**

**1. Klik tombol "🔄 RELOAD DATA" di halaman**

**2. Kalau masih kosong, cek Docker logs:**

```bash
docker-compose logs backend | grep -i "sentiment\|entities"
```

**3. Kalau ada error, screenshot dan kirim ke developer**

---

### ❌ Recording Error 500

**Error:**
```
Failed to load resource: the server responded with a status of 500
```

**Penyebab:** Biasanya tabrakan upload file + recording bersamaan.

**Solusi:**
- Jangan upload file sambil recording
- Tunggu upload selesai dulu, baru recording
- Atau sebaliknya

---

## 📊 MONITORING

### Lihat Docker Logs (Real-time)

```bash
docker-compose logs -f
```

Tekan `Ctrl + C` untuk stop.

### Lihat Logs Backend Saja

```bash
docker-compose logs -f backend
```

### Lihat 100 Baris Terakhir

```bash
docker-compose logs backend | tail -100
```

---

## 🔄 UPDATE CODE

### Git Pull Latest Changes

```bash
cd C:\Users\lenovo\Downloads\CyberMeeting
git pull origin claude/add-meeting-minutes-features-01Vxzx1ypd9u9miX5JVREduB
```

### Restart Docker After Update

```cmd
start-docker.bat
```

Atau manual:
```bash
docker-compose down
docker-compose up -d --build
```

---

## 🎯 COMPLETE WORKFLOW

### Saat Pertama Kali di Pagi Hari:

1. **Buka Docker Desktop** → Tunggu status "Running"

2. **Buka VS Code** → Buka folder project

3. **Buka Terminal** (`Ctrl + ~`):
   ```cmd
   start-docker.bat
   ```

4. **Buka Command Prompt BARU**:
   ```cmd
   cd C:\Users\lenovo\Downloads\CyberMeeting
   start-ngrok.bat
   ```

5. **Copy URL Ngrok** → Share ke rekan/client

6. **SELESAI!** naraMEET bisa diakses dari mana saja! 🎉

---

### Saat Ganti WiFi (Kantor → Rumah):

1. **Stop Docker**:
   ```bash
   docker-compose down
   ```

2. **Connect ke WiFi baru**

3. **Jalankan ulang**:
   ```cmd
   start-docker.bat
   ```

4. **IP otomatis berubah!**
   - Localhost tetap: `http://localhost:8000`
   - Network IP baru: `http://192.168.1.50:8000` (contoh)

5. **Ngrok tetap jalan** dengan URL yang sama!

---

## 💡 PRO TIPS

### 1. Bookmark URLs

Buat bookmark di browser:
- `http://localhost:8000` → "naraMEET Local"
- URL Ngrok → "naraMEET Production"

### 2. Keep Ngrok Running

Biarkan Command Prompt Ngrok tetap terbuka.
Jangan close! Kalau close, URL akan hilang.

### 3. Auto-Start Docker

Set Docker Desktop untuk auto-start saat Windows boot:
- Docker Desktop → Settings → General
- ✅ "Start Docker Desktop when you log in"

### 4. Pin Scripts di Taskbar

Pin `start-docker.bat` dan `start-ngrok.bat` di taskbar untuk quick access!

---

## 🚀 SUMMARY - Command Paling Penting

```cmd
# 1. Start Docker dengan IP auto-detect
start-docker.bat

# 2. Start Ngrok untuk production URL
start-ngrok.bat

# 3. Lihat logs kalau ada error
docker-compose logs -f backend

# 4. Update code
git pull origin claude/add-meeting-minutes-features-01Vxzx1ypd9u9miX5JVREduB

# 5. Restart Docker
docker-compose down
docker-compose up -d --build
```

---

**Made with ❤️ for naraMEET Production**

**Questions?** Contact developer or check logs!
