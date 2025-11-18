require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const https = require('https');
const { generateJitsiToken, generateMeetingUrl } = require('./utils/jitsi-jwt');

console.log('✅ Jitsi JWT helper loaded');

const { AssemblyAI } = require('assemblyai');

const assemblyClient = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY
});

console.log('✅ AssemblyAI SDK initialized');

// ✅ Load enhancements module
const enhancements = require('./server-enhancements');
console.log('✅ AssemblyAI Enhancements module loaded');

let emailTransporter = null;
let nodemailer = null;

try {
    nodemailer = require('nodemailer');
    console.log('✅ Nodemailer module loaded');

    if (process.env.ENABLE_EMAIL === 'true') {
        emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        emailTransporter.verify((error, success) => {
            if (error) {
                console.log('❌ Email service error:', error);
                emailTransporter = null;
            } else {
                console.log('✅ Email service ready');
            }
        });
    } else {
        console.log('ℹ️  Email service disabled');
    }
} catch (error) {
    console.error('⚠️  Nodemailer error:', error.message);
    emailTransporter = null;
}

async function sendMeetingMinutesEmail(meeting, participants, transcripts, summary, attachmentPath = null) {
    if (!emailTransporter) {
        throw new Error('Email service not configured');
    }
    
    const emailPromises = participants.map(async (participant) => {
        const mailOptions = {
            from: `"naraMeet" <${process.env.SMTP_USER}>`,
            to: participant.email,
            subject: `Meeting Minutes: ${meeting.title}`,
            html: generateEmailHTML(meeting, participant, transcripts, summary),
            attachments: attachmentPath ? [{
                filename: `meeting-${meeting.id}.pdf`,
                path: attachmentPath
            }] : []
        };
        
        try {
            const info = await emailTransporter.sendMail(mailOptions);
            console.log(`✅ Email sent to ${participant.email}:`, info.messageId);
            return { success: true, email: participant.email };
        } catch (error) {
            console.error(`❌ Failed to send email to ${participant.email}:`, error);
            return { success: false, email: participant.email, error: error.message };
        }
    });
    
    return Promise.all(emailPromises);
}

function generateEmailHTML(meeting, participant, transcripts, summary) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { background: linear-gradient(45deg, #00ff88, #00ffff); padding: 20px; text-align: center; border-radius: 10px; margin-bottom: 20px; }
        .header h1 { color: white; margin: 0; }
        .content { color: #333; line-height: 1.6; }
        .info-box { background: #f0f9ff; padding: 15px; border-left: 4px solid #00ffff; margin: 20px 0; }
        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ Meeting Minutes ⚡</h1>
        </div>
        
        <div class="content">
            <p>Hi ${participant.name},</p>
            <p>Here are the minutes from our recent meeting:</p>
            
            <div class="info-box">
                <strong>📅 ${meeting.title}</strong><br>
                <strong>🕐 Date:</strong> ${new Date(meeting.date).toLocaleString()}<br>
                <strong>📍 Location:</strong> ${meeting.location || 'N/A'}
            </div>
            
            ${summary ? `
            <h3>📋 Key Points</h3>
            <p>${summary.key_points || 'No key points recorded'}</p>
            
            <h3>✅ Action Items</h3>
            <p>${summary.action_items || 'No action items recorded'}</p>
            ` : ''}
            
            <p>Please find the complete meeting transcript attached to this email.</p>
            
            <p>Best regards,<br><strong>naraMeet Team</strong></p>
        </div>
        
        <div class="footer">
            <p>⚡ Powered by naraMeet v2.0 ULTIMATE ⚡</p>
            <p>This is an automated email. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
    `;
}

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ENABLE_AUTH = process.env.ENABLE_AUTH !== 'false';
const JWT_SECRET = process.env.JWT_SECRET || 'narameet-secret-change-in-production';
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;

const shouldUseSSL = () => {
    const dbUrl = process.env.DATABASE_URL || '';
    
    if (dbUrl.includes('sslmode=disable') || dbUrl.includes('ssl=false')) {
        console.log('ℹ️  SSL: Disabled (via connection string)');
        return false;
    }
    
    if (process.env.NODE_ENV === 'production') {
        console.log('✅ SSL: Enabled (production mode)');
        return { rejectUnauthorized: false };
    }
    
    console.log('ℹ️  SSL: Disabled (development mode)');
    return false;
};

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: shouldUseSSL(),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Database connection test successful:', res.rows[0].now);
    }
});

async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('✅ Query executed:', { duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('❌ Query error:', error.message);
        throw error;
    }
}

async function queryOne(text, params) {
    const res = await query(text, params);
    return res.rows[0] || null;
}

async function queryAll(text, params) {
    const res = await query(text, params);
    return res.rows;
}

async function withTransaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));



// Get all contacts (user's own + shared)
app.get('/api/contacts', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Get user's own contacts + shared contacts
        const result = await query(
            `SELECT * FROM contacts 
             WHERE (user_id = $1 OR is_shared = true) 
             AND deleted_at IS NULL 
             ORDER BY name ASC`,
            [userId]
        );
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('❌ Get contacts error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new contact
app.post('/api/contacts', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, email, phone, role, company, is_shared } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name and email are required' 
            });
        }
        
        const result = await queryOne(
            `INSERT INTO contacts (user_id, name, email, phone, role, company, is_shared)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [userId, name, email, phone || null, role || null, company || null, is_shared || false]
        );
        
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('❌ Add contact error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update contact
app.put('/api/contacts/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const contactId = req.params.id;
        const { name, email, phone, role, company, is_shared } = req.body;
        
        // Only owner can update
        const result = await queryOne(
            `UPDATE contacts 
             SET name = $1, email = $2, phone = $3, role = $4, company = $5, is_shared = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 AND user_id = $8 AND deleted_at IS NULL
             RETURNING *`,
            [name, email, phone, role, company, is_shared, contactId, userId]
        );
        
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contact not found or unauthorized' 
            });
        }
        
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('❌ Update contact error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete contact (soft delete)
app.delete('/api/contacts/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const contactId = req.params.id;
        
        const result = await queryOne(
            `UPDATE contacts 
             SET deleted_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
             RETURNING id`,
            [contactId, userId]
        );
        
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contact not found or unauthorized' 
            });
        }
        
        res.json({ success: true, message: 'Contact deleted' });
    } catch (error) {
        console.error('❌ Delete contact error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/users', authMiddleware, async (req, res) => {
    try {
        // Only show active users (exclude deleted)
        const users = await queryAll(
            `SELECT id, username, email, name, role 
             FROM users 
             WHERE deleted_at IS NULL AND is_active = true
             ORDER BY name ASC`
        );
        
        res.json({ 
            success: true, 
            data: users 
        });
    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /wav|mp3|m4a|ogg|webm|flac|aac|opus/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only audio files are allowed'));
    }
});

// ✅ Multer config for video recordings
const uploadRecording = multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit for recordings
    fileFilter: (req, file, cb) => {
        const allowedTypes = /wav|mp3|m4a|ogg|webm|flac|aac|opus|mp4|avi|mov|mkv/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Only audio/video files are allowed'));
    }
});

function authMiddleware(req, res, next) {
    if (!ENABLE_AUTH) {
        req.user = { userId: 1, username: 'admin', role: 'admin' };  // ← HARUS ADA INI
        req.userId = 1;
        req.username = 'admin';
        return next();
    }
    
    try {
        const authHeader = req.headers['authorization'];
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false, 
                error: 'No authorization token provided' 
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid authorization format' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // ========== PENTING: HARUS ADA BARIS INI ==========
        req.user = {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role
        };
        // ========== END PENTING ==========
        
        req.userId = decoded.userId;
        req.username = decoded.username;
        req.userRole = decoded.role;
        
        next();
        
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid or expired token' 
        });
    }
}

/**
 * Generate keyterms untuk improve accuracy
 */
async function generateKeyterms(meetingId) {
    try {
        // Get participant names
        const participants = await queryAll(
            'SELECT name FROM participants WHERE meeting_id = $1 AND deleted_at IS NULL',
            [meetingId]
        );
        
        const keyterms = [
            // Participant names
            ...participants.map(p => p.name),
            
            // Common meeting terms (ALWAYS HELPFUL)
            "action item", "follow up", "deadline", 
            "quarterly", "revenue", "roadmap",
            "API", "dashboard", "production", "deployment",
            
            // ✅ CUSTOMIZE INI sesuai company/project Anda:
            "naraMeet", "AssemblyAI", "LeMUR", "Jitsi",
            "meeting minutes", "transcript"
        ];
        
        console.log(`📝 Generated ${keyterms.length} keyterms:`, keyterms);
        return keyterms;
        
    } catch (error) {
        console.error('⚠️ Keyterms generation error:', error);
        return []; // Return empty array if failed
    }
}


// ==================== ASSEMBLY AI TRANSCRIPTION FUNCTIONS ====================

/**
 * ✅ ENHANCED: Transcribe audio file with AssemblyAI
 * Now includes: Auto Highlights, Sentiment Analysis, Entity Detection, Auto Chapters
 */
async function transcribeWithAssemblyAI(filePath, language = 'id', enableDiarization = true, meetingId = null) {
    // Use enhanced transcription from enhancements module
    return await enhancements.transcribeWithAssemblyAIEnhanced(
        filePath,
        language,
        enableDiarization,
        meetingId,
        assemblyClient,
        queryOne,
        query
    );
}

/**
 * Generate AI summary using LeMUR
 */
async function generateSummaryWithLeMUR(transcriptId, customPrompt = null) {
    try {
        console.log('🤖 Generating AI summary with LeMUR...');
        console.log(`📄 Transcript ID: ${transcriptId}`);

        
        // Get transcript with utterances to get full text
        const transcriptData = await assemblyClient.transcripts.get(transcriptId);

        // Build full text from utterances (more accurate than transcriptData.text)
        let allText = '';
        if (transcriptData.utterances && transcriptData.utterances.length > 0) {
            allText = transcriptData.utterances.map(u => u.text).join(' ');
        } else {
            allText = transcriptData.text || '';
        }

        const wordCount = allText.trim().split(/\s+/).filter(w => w.length > 0).length;

        console.log(`📊 Transcript word count: ${wordCount} words`);
        console.log(`📝 Full text preview: ${allText.substring(0, 200)}...`);

        // Warning untuk transcript pendek tapi tetap process
        if (wordCount < 10) {
            console.warn(`⚠️ Transcript pendek: ${wordCount} kata (minimal 10 kata recommended)`);
            
            // Jika sangat pendek, return simple summary
            if (wordCount === 0) {
                return {
                    summary: "## CATATAN\n⚠️ Audio tidak mengandung ucapan yang dapat dideteksi. Pastikan:\n- Microphone berfungsi dengan baik\n- Volume audio cukup keras\n- Tidak ada gangguan background noise yang berlebihan",
                    usage: { prompt_tokens: 0, completion_tokens: 0 },
                    wordCount: 0,
                    warning: "Audio kosong atau tidak terdeteksi"
                };
            }
        }
        // Warning untuk transcript pendek (10-20 kata)
        let validationWarning = null;
        if (wordCount >= 10 && wordCount < 20) {
            validationWarning = `⚠️ Transcript pendek (${wordCount} kata). Summary mungkin kurang detail.`;
            console.log(`[WARNING] ${validationWarning}`);
        }
        // ========== END VALIDATION ==========
        
        const defaultPrompt = `Anda adalah AI Assistant profesional yang menganalisis transkrip meeting bisnis. Tugas Anda adalah membuat notulen meeting yang LENGKAP, DETAIL, dan TERSTRUKTUR dalam BAHASA INDONESIA.

=== KONTEKS ===
Anda akan menerima transkrip meeting yang mungkin berisi:
- Diskusi formal tim/project
- Brainstorming session
- Client presentation
- Review meeting
- Interview atau wawancara
- ATAU percakapan casual (bukan meeting formal)

=== INSTRUKSI ANALISIS ===

LANGKAH 1 - IDENTIFIKASI JENIS KONTEN:
Pertama, tentukan apakah ini MEETING FORMAL atau CASUAL CONVERSATION:

A. JIKA MEETING FORMAL (ada agenda, diskusi bisnis, decision making, atau interview):
   → Lanjutkan ke analisis lengkap

B. JIKA CASUAL CONVERSATION/MONOLOG (cerita pribadi, ngobrol santai, tidak ada agenda bisnis):
   → Buat summary singkat saja dengan format:

   ## RINGKASAN PERCAKAPAN
   [Jelaskan topik utama yang dibahas dalam 2-3 paragraf]

   ## CATATAN
   ⚠️ Konten ini bukan meeting formal melainkan percakapan kasual/cerita. Tidak ada action items atau keputusan bisnis yang dapat diekstrak.

   Untuk hasil analisis meeting yang optimal, gunakan rekaman meeting bisnis formal dengan:
   - Multiple speakers yang berdiskusi
   - Agenda atau topik bisnis yang jelas
   - Keputusan dan action items

   [STOP DI SINI, jangan lanjut ke section lain]

=== FORMAT OUTPUT UNTUK MEETING FORMAL ===

## 📋 RINGKASAN EKSEKUTIF
[2-4 paragraf ringkasan meeting secara keseluruhan: tujuan meeting, topik utama, hasil akhir, dan kesimpulan penting]

## 🎯 POIN UTAMA PEMBAHASAN
[Tulis 8-15 poin pembahasan utama dengan DETAIL, gunakan format:]
- **[Topik]**: [Penjelasan LENGKAP apa yang dibahas, siapa yang membahas, data/angka yang disebutkan, dan keputusan jika ada]

**PENTING**: Untuk meeting yang panjang (>30 menit), ekstrak MINIMAL 10-15 poin pembahasan.

Contoh:
- **Data Mahasiswa & Target PMB**: Saat ini ada 332 mahasiswa dari 5 angkatan, dengan 136 mahasiswa baru tahun ini. Target tahun depan adalah 1000 mahasiswa untuk satu prodi. Program mencakup mahasiswa hybrid (online & offline).
- **Jalur Penerimaan**: Ada dua jalur yaitu beasiswa dan non-beasiswa. Beasiswa memiliki 3 tes (bahasa Inggris, TKD website, dan wawancara). Pendaftaran dibuka Januari-September, kuliah dimulai Oktober.
- **Promosi Offline**: Fokus ke 50 sekolah terdekat dengan target kunjungan lebih dari 1x. Tim promosi terdiri dari dosen dan mahasiswa. Setiap kunjungan wajib ada laporan lengkap dengan absensi dan dokumentasi.

## ✅ ACTION ITEMS & PIC
[Ekstrak SEMUA tugas, follow-up, dan hal yang perlu dilakukan. Baca transkrip dengan teliti untuk menemukan:]
- Permintaan data atau dokumen
- Janji untuk mengirimkan sesuatu
- Tugas yang disebutkan akan dikerjakan
- Follow-up yang perlu dilakukan

Format:
- [ ] **[Nama PIC]** - [Tugas detail dengan konteks] - [Deadline jika disebutkan]

Contoh:
- [ ] **Mbak Gina** - Kirimkan pertanyaan lanjutan perihal website dan PMB ke Mas Rusti - Segera
- [ ] **Mas Alfie** - Share laporan kegiatan promosi offline sebagai contoh format - Dalam waktu dekat
- [ ] **Tim PMB** - Siapkan data sekolah (nama, alamat, PIC) dalam format Excel - Sebelum meeting berikutnya

**PENTING**: Jika tidak ada action items eksplisit, ekstrak implied action items dari diskusi (misalnya: "nanti saya kirimkan" = action item untuk mengirimkan sesuatu).

JIKA BENAR-BENAR TIDAK ADA ACTION ITEMS:
⚠️ Tidak ada action items spesifik yang dapat diidentifikasi dari transkrip ini.

## 🎯 KEPUTUSAN & KESEPAKATAN
[Tulis SEMUA keputusan, kesepakatan, dan kesimpulan penting. Termasuk:]
- Persetujuan atau penolakan
- Kesepakatan bersama
- Pilihan yang diambil
- Kesimpulan diskusi

Format:
- ✓ **[Keputusan]**: [Detail lengkap dengan alasan dan pihak yang terlibat]

Contoh:
- ✓ **Target Mahasiswa Baru 1000 Orang**: Disepakati untuk satu prodi, termasuk program hybrid (online & offline). Akan direview lagi setelah melihat hasil promosi.
- ✓ **Fokus Promosi ke 50 Sekolah Terdekat**: Disetujui strategi kunjungan intensif (minimal 10x per tahun) ke sekolah dalam radius terdekat kampus.
- ✓ **Sistem PMB Baru Dibutuhkan**: Disepakati perlu sistem untuk tracking agen, jadwal promosi, dan laporan kegiatan otomatis.

JIKA TIDAK ADA KEPUTUSAN FORMAL:
⚠️ Tidak ada keputusan formal yang diambil dalam meeting ini (meeting bersifat diskusi/sharing informasi).

## 📅 NEXT STEPS & FOLLOW UP
[Tulis langkah selanjutnya, jadwal meeting berikutnya, dan timeline yang disebutkan]

Contoh:
- Meeting follow-up: Akan dijadwalkan setelah data lengkap terkumpul
- Deadline pengumpulan data: 2 minggu dari sekarang
- Agenda next meeting: Review sistem PMB dan fitur yang akan diimplementasikan
- Timeline implementasi: Kick-off development dalam 1 bulan

## 👥 PARTISIPAN & PIHAK YANG TERLIBAT
[Ekstrak SEMUA nama yang disebutkan dalam transkrip, kategorikan berdasarkan peran jika bisa diidentifikasi]

Format:
- **[Nama]** - [Role/Jabatan jika disebutkan] - [Kontribusi dalam meeting]

Contoh:
- **Mbak Gina (Tim Teknis)** - Lead interviewer, menanyakan detail requirement sistem PMB
- **Bu Dela & Bu Ayu** - Tidak hadir dalam meeting ini
- **Mas Alfie** - Tim Promosi, menjelaskan proses kunjungan sekolah dan laporan kegiatan
- **Pak Zul (Pimpinan)** - Menyetujui keputusan dan memberikan arahan strategi
- **Speaker A, Speaker B** - Partisipan tidak teridentifikasi

## 📊 DATA & ANGKA PENTING
[Ekstrak SEMUA data kuantitatif, angka, statistik, dan metrics yang disebutkan]

Contoh:
- 332 mahasiswa total (5 angkatan)
- 136 mahasiswa baru tahun ini
- Target 1000 mahasiswa tahun depan
- 76 mahasiswa dari jalur beasiswa
- 105 sekolah asal mahasiswa saat ini
- 50 sekolah target prioritas untuk promosi
- Budget: Belum ditentukan spesifik
- Timeline: Pendaftaran Januari-September, kuliah dimulai Oktober

=== ATURAN PENTING ===

1. **BAHASA**: Seluruh output WAJIB dalam Bahasa Indonesia
2. **EKSTRAKSI NAMA**: Cari dan gunakan nama asli dari transkrip (JANGAN "Speaker A/B" kecuali benar-benar tidak ada nama)
3. **DETAIL ANGKA**: Tulis SEMUA angka, persentase, dan data kuantitatif yang disebutkan
4. **SPESIFIK**: Action items harus spesifik dan actionable dengan konteks lengkap
5. **OBJEKTIF**: Tulis apa yang BENAR-BENAR dibahas, jangan tambahkan interpretasi
6. **LENGKAP**: Untuk meeting >30 menit, output MINIMAL 1500 kata total
7. **HONEST**: Jika tidak ada data untuk section tertentu, tulis "Tidak ada [X] yang dapat diidentifikasi"
8. **CONTEXT-AWARE**: Jika transkrip tidak jelas, tambahkan catatan di akhir

=== CATATAN KHUSUS ===

Jika transkrip:
- Terpotong-potong atau tidak jelas → Tambahkan note: "⚠️ Transkrip terpotong-potong, beberapa detail mungkin terlewat"
- Tidak ada pembicara kedua → Note: "⚠️ Ini adalah monolog, bukan meeting multi-partisipan"
- Topik melompat-lompat → Note: "ℹ️ Meeting berbentuk brainstorming/diskusi terbuka dengan banyak topik"
- Sangat pendek (<100 kata) → Note: "⚠️ Rekaman sangat pendek, mungkin incomplete"

**REMINDER PENTING**:
- Meeting yang PANJANG (>30 menit) = Summary PANJANG (minimal 1500 kata)
- Meeting 1 jam+ = Summary harus 2000-3000 kata dengan 10-20 poin pembahasan
- JANGAN membuat summary terlalu singkat untuk meeting yang panjang!

Sekarang analisis transkrip berikut dan buat notulen meeting yang LENGKAP dan PROFESIONAL:`;
        
        const result = await assemblyClient.lemur.task({
            transcript_ids: [transcriptId],
            prompt: customPrompt || defaultPrompt,
            final_model: process.env.LEMUR_MODEL || 'anthropic/claude-sonnet-4-20250514',
            max_output_size: parseInt(process.env.LEMUR_MAX_TOKENS) || 4000,
            temperature: parseFloat(process.env.LEMUR_TEMPERATURE) || 0.3
        });
        
        console.log('✅ LeMUR summary generated');
        console.log(`📊 Response length: ${result.response?.length || 0} characters`);
        
        return {
            summary: result.response,
            usage: result.usage,
            wordCount: wordCount,
            warning: validationWarning
        };
        
    } catch (error) {
        console.error('❌ LeMUR generation error:', error);
        throw new Error(`LeMUR summary generation failed: ${error.message}`);
    }
}

/**
 * Ask questions about meeting using LeMUR Q&A
 */
async function askMeetingQuestions(transcriptId, questions) {
    try {
        console.log('💬 Processing Q&A with LeMUR...');
        console.log(`❓ Questions: ${questions.length}`);
        
        const formattedQuestions = questions.map(q => ({
            question: typeof q === 'string' ? q : q.question,
            answer_format: q.answer_format || undefined
        }));
        
        const result = await assemblyClient.lemur.questionAnswer({
            transcript_ids: [transcriptId],
            questions: formattedQuestions,
            final_model: process.env.LEMUR_MODEL || 'anthropic/claude-sonnet-4-20250514'
        });
        
        console.log('✅ Q&A completed');
        
        return {
            answers: result.response,
            usage: result.usage
        };
        
    } catch (error) {
        console.error('❌ LeMUR Q&A error:', error);
        throw new Error(`LeMUR Q&A failed: ${error.message}`);
    }
}

// ==================== API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            database: 'connected',
            assemblyai: process.env.ASSEMBLYAI_API_KEY ? 'enabled' : 'disabled',
            lemur: 'enabled',
            auth: ENABLE_AUTH ? 'enabled' : 'disabled',
            email: emailTransporter ? 'enabled' : 'disabled'
        }
    });
});

// ==================== AUTHENTICATION ====================

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username and password required' 
            });
        }
        
        const user = await queryOne(
            'SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username]
        );
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }
        
        if (!user.is_active) {
            return res.status(401).json({ 
                success: false, 
                error: 'Account is disabled' 
            });
        }
        
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Login failed' 
        });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, name } = req.body;
        
        if (!username || !email || !password || !name) {
            return res.status(400).json({ 
                success: false,
                error: 'All fields required' 
            });
        }
        
        const existingUser = await queryOne(
            'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username]
        );
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                error: 'Username already exists' 
            });
        }
        
        const existingEmail = await queryOne(
            'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
            [email]
        );
        
        if (existingEmail) {
            return res.status(400).json({ 
                success: false,
                error: 'Email already exists' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await queryOne(
            `INSERT INTO users (username, email, password, name, role, is_active) 
             VALUES ($1, $2, $3, $4, 'user', true) 
             RETURNING id, username, email, name, role`,
            [username, email, hashedPassword, name]
        );
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Registration failed' 
        });
    }
});

app.get('/api/verify', authMiddleware, async (req, res) => {
    try {
        const user = await queryOne(
            'SELECT id, username, email, name, role FROM users WHERE id = $1 AND deleted_at IS NULL',
            [req.userId]
        );
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        res.json({ 
            success: true, 
            user: user 
        });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Verification failed' 
        });
    }
});

// ==================== MEETINGS API ====================

app.get('/api/meetings', authMiddleware, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status, 
            search 
        } = req.query;
        
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE m.deleted_at IS NULL AND m.user_id = $1';
        const params = [req.userId, parseInt(limit), offset];
        let paramIndex = 4;
        
        if (status) {
            whereClause += ` AND m.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        if (search) {
            whereClause += ` AND m.title ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        const meetings = await queryAll(
            `SELECT 
                m.*,
                COUNT(DISTINCT p.id) as participant_count,
                COUNT(DISTINCT t.id) as transcript_count,
                CASE WHEN s.id IS NOT NULL THEN true ELSE false END as has_summary
             FROM meetings m
             LEFT JOIN participants p ON m.id = p.meeting_id AND p.deleted_at IS NULL
             LEFT JOIN transcripts t ON m.id = t.meeting_id AND t.deleted_at IS NULL
             LEFT JOIN meeting_summaries s ON m.id = s.meeting_id AND s.deleted_at IS NULL
             ${whereClause}
             GROUP BY m.id, s.id
             ORDER BY m.created_at DESC
             LIMIT $2 OFFSET $3`,
            params
        );
        
        const countResult = await queryOne(
            `SELECT COUNT(*) as total FROM meetings m ${whereClause.replace(/LIMIT.*$/i, '')}`,
            params.slice(0, paramIndex - 3)
        );
        
        res.json({
            success: true,
            data: meetings,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.total),
                totalPages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Get meetings error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch meetings' 
        });
    }
});

// Get meetings where user is invited as participant
app.get('/api/meetings/invited', authMiddleware, async (req, res) => {
    try {
        const user = await queryOne(
            'SELECT * FROM users WHERE id = $1',
            [req.userId]
        );
        
        const meetings = await queryAll(
            `SELECT DISTINCT m.*, 
                    u.name as creator_name,
                    u.email as creator_email
             FROM meetings m
             INNER JOIN participants p ON m.id = p.meeting_id AND p.deleted_at IS NULL
             LEFT JOIN users u ON m.user_id = u.id
             WHERE p.email = $1 
               AND m.user_id != $2
               AND m.deleted_at IS NULL
             ORDER BY m.date DESC`,
            [user.email, req.userId]
        );
        
        res.json({
            success: true,
            data: meetings
        });
    } catch (error) {
        console.error('❌ Get invited meetings error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/meetings/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const meeting = await queryOne(
            `SELECT * FROM meetings 
             WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
            [id, req.userId]
        );
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        const participants = await queryAll(
            `SELECT * FROM participants 
             WHERE meeting_id = $1 AND deleted_at IS NULL 
             ORDER BY created_at`,
            [id]
        );
        
        const transcripts = await queryAll(
            `SELECT * FROM transcripts 
             WHERE meeting_id = $1 AND deleted_at IS NULL 
             ORDER BY sequence_number, created_at`,
            [id]
        );
        
        const summary = await queryOne(
            `SELECT * FROM meeting_summaries 
             WHERE meeting_id = $1 AND deleted_at IS NULL`,
            [id]
        );
        
        const audioFiles = await queryAll(
            `SELECT * FROM audio_files 
             WHERE meeting_id = $1 AND deleted_at IS NULL 
             ORDER BY uploaded_at DESC`,
            [id]
        );
        
        res.json({
            success: true,
            data: {
                meeting,
                participants,
                transcripts,
                summary,
                audioFiles
            }
        });
    } catch (error) {
        console.error('❌ Get meeting error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch meeting' 
        });
    }
});

app.post('/api/meetings', authMiddleware, async (req, res) => {
    try {
        const { title, date, location, description, participants } = req.body;
        
        if (!title || !date) {
            return res.status(400).json({ 
                success: false,
                error: 'Title and date required' 
            });
        }
        
        const result = await withTransaction(async (client) => {
            const meeting = await client.query(
                `INSERT INTO meetings (user_id, title, date, location, description, status, created_by)
                 VALUES ($1, $2, $3, $4, $5, 'draft', $1)
                 RETURNING *`,
                [req.userId, title, date, location || null, description || null]
            );
            
            const meetingId = meeting.rows[0].id;
            
            if (participants && Array.isArray(participants) && participants.length > 0) {
                for (const p of participants) {
                    await client.query(
                        `INSERT INTO participants (meeting_id, name, email, phone, role)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [meetingId, p.name, p.email, p.phone || null, p.role || null]
                    );
                }
            }
            
            return meeting.rows[0];
        });
        
        res.status(201).json({
            success: true,
            message: 'Meeting created successfully',
            data: result
        });
    } catch (error) {
        console.error('❌ Create meeting error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create meeting' 
        });
    }
});

app.put('/api/meetings/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, location, status, description } = req.body;
        
        const existing = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, req.userId]
        );
        
        if (!existing) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        const updated = await queryOne(
            `UPDATE meetings 
             SET title = COALESCE($1, title),
                 date = COALESCE($2, date),
                 location = COALESCE($3, location),
                 status = COALESCE($4, status),
                 description = COALESCE($5, description),
                 updated_by = $6
             WHERE id = $7
             RETURNING *`,
            [title, date, location, status, description, req.userId, id]
        );
        
        res.json({
            success: true,
            message: 'Meeting updated successfully',
            data: updated
        });
    } catch (error) {
        console.error('❌ Update meeting error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update meeting' 
        });
    }
});

app.delete('/api/meetings/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const existing = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, req.userId]
        );
        
        if (!existing) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        await query(
            'UPDATE meetings SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Meeting deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete meeting error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete meeting' 
        });
    }
});

// ==================== PARTICIPANTS API ====================

app.post('/api/meetings/:id/participants', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, role } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ 
                success: false,
                error: 'Name and email required' 
            });
        }
        
        const meeting = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, req.userId]
        );
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        const participant = await queryOne(
            `INSERT INTO participants (meeting_id, name, email, phone, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [id, name, email, phone || null, role || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Participant added successfully',
            data: participant
        });
    } catch (error) {
        console.error('❌ Add participant error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to add participant' 
        });
    }
});

app.put('/api/participants/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, role, attended } = req.body;
        
        const existing = await queryOne(
            `SELECT p.* FROM participants p
             JOIN meetings m ON p.meeting_id = m.id
             WHERE p.id = $1 AND m.user_id = $2 AND p.deleted_at IS NULL`,
            [id, req.userId]
        );
        
        if (!existing) {
            return res.status(404).json({ 
                success: false,
                error: 'Participant not found' 
            });
        }
        
        const updated = await queryOne(
            `UPDATE participants
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 phone = COALESCE($3, phone),
                 role = COALESCE($4, role),
                 attended = COALESCE($5, attended)
             WHERE id = $6
             RETURNING *`,
            [name, email, phone, role, attended, id]
        );
        
        res.json({
            success: true,
            message: 'Participant updated successfully',
            data: updated
        });
    } catch (error) {
        console.error('❌ Update participant error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update participant' 
        });
    }
});

app.delete('/api/participants/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const existing = await queryOne(
            `SELECT p.* FROM participants p
             JOIN meetings m ON p.meeting_id = m.id
             WHERE p.id = $1 AND m.user_id = $2 AND p.deleted_at IS NULL`,
            [id, req.userId]
        );
        
        if (!existing) {
            return res.status(404).json({ 
                success: false,
                error: 'Participant not found' 
            });
        }
        
        await query(
            'UPDATE participants SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Participant deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete participant error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete participant' 
        });
    }
});

// ==================== TRANSCRIPTION API (ASSEMBLY AI) ====================

app.post('/api/transcribe', authMiddleware, upload.single('audio'), async (req, res) => {
    console.log('📥 Transcription request received (AssemblyAI)');
    
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            error: 'No audio file provided' 
        });
    }
    
    const { 
        meeting_id, 
        language = 'multi', 
        enable_diarization = 'true',
        enable_normalize = 'true',
        enable_noise_reduction = 'true',
        enable_compression = 'false'
    } = req.body;
    
    
    if (!meeting_id) {
        return res.status(400).json({ 
            success: false, 
            error: 'Meeting ID required' 
        });
    }
    
    let audioFileId = null;
    let assemblyTranscriptId = null;
    
    try {
        const meetingCheck = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [meeting_id, req.userId]
        );
        
        if (!meetingCheck) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ 
                success: false, 
                error: 'Meeting not found' 
            });
        }
        
        console.log(`🎤 Processing audio: ${req.file.originalname}`);
        console.log(`📊 Size: ${req.file.size} bytes, Format: ${req.file.mimetype}`);
        
        // Save audio file record
        const audioResult = await queryOne(
            `INSERT INTO audio_files (meeting_id, filename, original_filename, file_path, file_size, format, mime_type, processing_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing')
             RETURNING id`,
            [
                meeting_id,
                req.file.filename,
                req.file.originalname,
                req.file.path,
                req.file.size,
                path.extname(req.file.originalname).slice(1).toLowerCase(),
                req.file.mimetype
            ]
        );
        
        audioFileId = audioResult.id;
        console.log(`💾 Audio file saved to database (ID: ${audioFileId})`);

        // Audio Enhancement with FFmpeg (if enabled)
        let enhancedFilePath = req.file.path;
        
        if (enable_normalize === 'true' || enable_noise_reduction === 'true' || enable_compression === 'true') {
            console.log('🎛️ Applying audio enhancements...');
            
            try {
                const { exec } = require('child_process');
                const util = require('util');
                const execPromise = util.promisify(exec);
                
                const enhancedPath = req.file.path.replace(/\.[^.]+$/, '_enhanced.wav');
                let ffmpegFilters = [];
                
                if (enable_noise_reduction === 'true') {
                    // Aggressive noise reduction untuk audio meeting
                    ffmpegFilters.push(
                        'highpass=f=80',           // Cut low rumble
                        'lowpass=f=8000',          // Cut high hiss
                        'afftdn=nf=-20:nt=w',      // Noise reduction (white noise)
                        'anlmdn=s=10:p=0.002:r=0.002', // Advanced noise reduction
                        'equalizer=f=3000:t=q:w=1:g=3',  // Boost speech frequency
                        'compand=attacks=0.3:decays=0.8:points=-80/-900|-45/-15|-27/-9|0/-7|20/-7:soft-knee=6:gain=0:volume=0:delay=0.05' // Reduce background
                    );
                }
                
                if (enable_normalize === 'true') {
                    ffmpegFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
                }
                
                if (enable_compression === 'true') {
                    ffmpegFilters.push('acompressor=threshold=0.089:ratio=9:attack=200:release=1000');
                }
                
                const filterString = ffmpegFilters.length > 0 ? `-af "${ffmpegFilters.join(',')}"` : '';
                
                const ffmpegCommand = `ffmpeg -i "${req.file.path}" ${filterString} -ar 16000 -ac 1 "${enhancedPath}" -y`;
                
                console.log('📊 FFmpeg command:', ffmpegCommand);
                
                await execPromise(ffmpegCommand);
                
                enhancedFilePath = enhancedPath;
                console.log('✅ Audio enhanced successfully');
                
            } catch (enhanceError) {
                console.warn('⚠️ Audio enhancement failed, using original:', enhanceError.message);
                enhancedFilePath = req.file.path;
            }
        }

        // ✅ Transcribe with AssemblyAI + KEYTERMS (UPDATED!)
        const transcriptionResult = await transcribeWithAssemblyAI(
            enhancedFilePath,
            language,
            enable_diarization === 'true',
            meeting_id
        );

        // Extract segments from the result object
        const transcriptSegments = transcriptionResult.segments || [];

        console.log(`✅ Transcription complete: ${transcriptSegments.length} segments`);

        if (transcriptSegments.length === 0) {
            throw new Error('No transcript generated - audio may be empty or corrupted');
        }

        // Save transcript segments to database
        let savedTranscripts = [];
        for (let i = 0; i < transcriptSegments.length; i++) {
            const segment = transcriptSegments[i];

            const result = await queryOne(
                `INSERT INTO transcripts (meeting_id, speaker, text, start_time, end_time, sequence_number, confidence_score, sentiment, sentiment_score)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [
                    meeting_id,
                    segment.speaker,
                    segment.text,
                    segment.start,
                    segment.end,
                    i,
                    segment.confidence || 0.95,
                    segment.sentiment || 'NEUTRAL',
                    segment.sentiment_score || 0.5
                ]
            );

            savedTranscripts.push(result);
        }
        
        // Update audio file status
        await query(
            `UPDATE audio_files 
             SET processed = true, 
                 processing_status = 'completed',
                 duration = $2
             WHERE id = $1`,
            [
                audioFileId,
                transcriptSegments.length > 0 
                    ? Math.round(transcriptSegments[transcriptSegments.length - 1].end / 1000)
                    : 0
            ]
        );
        
        // Update meeting status
        await query(
            `UPDATE meetings SET status = 'completed' WHERE id = $1`,
            [meeting_id]
        );
        
        console.log(`✅ Saved ${savedTranscripts.length} transcript segments to database`);
        
        res.json({
            success: true,
            message: `Transcription complete: ${savedTranscripts.length} segments`,
            transcript: savedTranscripts,
            audio_file_id: audioFileId,
            method: 'assemblyai'
        });
        
    } catch (error) {
        console.error('❌ Transcription error:', error);
        
        if (audioFileId) {
            await query(
                `UPDATE audio_files 
                 SET processing_status = 'failed',
                     processing_error = $2
                 WHERE id = $1`,
                [audioFileId, error.message]
            );
        }
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.put('/api/transcripts/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { speaker, text } = req.body;
        
        const existing = await queryOne(
            `SELECT t.* FROM transcripts t
             JOIN meetings m ON t.meeting_id = m.id
             WHERE t.id = $1 AND m.user_id = $2 AND t.deleted_at IS NULL`,
            [id, req.userId]
        );
        
        if (!existing) {
            return res.status(404).json({ 
                success: false,
                error: 'Transcript not found' 
            });
        }
        
        const updated = await queryOne(
            `UPDATE transcripts
             SET speaker = COALESCE($1, speaker),
                 text = COALESCE($2, text),
                 is_edited = true
             WHERE id = $3
             RETURNING *`,
            [speaker, text, id]
        );
        
        res.json({
            success: true,
            message: 'Transcript updated successfully',
            data: updated
        });
    } catch (error) {
        console.error('❌ Update transcript error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update transcript' 
        });
    }
});

// ==================== AI SUMMARY API (LEMUR) ====================

/**
 * Generate AI summary for meeting
 */
app.post('/api/summary/generate', authMiddleware, async (req, res) => {
    try {
        const { meeting_id, custom_prompt } = req.body;
        
        if (!meeting_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Meeting ID required' 
            });
        }
        
        console.log(`🤖 Generating AI summary for meeting ${meeting_id}...`);
        
        // Get meeting and transcript
        const meeting = await queryOne(
            'SELECT * FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [meeting_id, req.userId]
        );
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false, 
                error: 'Meeting not found' 
            });
        }
        
        const transcripts = await queryAll(
            'SELECT * FROM transcripts WHERE meeting_id = $1 AND deleted_at IS NULL ORDER BY sequence_number',
            [meeting_id]
        );
        
        if (transcripts.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No transcript found. Please transcribe audio first.' 
            });
        }
        
        // Get audio file ID to get AssemblyAI transcript ID
        const audioFile = await queryOne(
            'SELECT * FROM audio_files WHERE meeting_id = $1 AND processed = true ORDER BY uploaded_at DESC LIMIT 1',
            [meeting_id]
        );
        
        if (!audioFile) {
            return res.status(400).json({ 
                success: false, 
                error: 'No processed audio file found' 
            });
        }
        
        // For now, we need to upload transcript to AssemblyAI to get transcript_id
        // This is a workaround - in production, store assembly_transcript_id in audio_files table
        
        // Create full transcript text
        const fullText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n\n');
        
        // Upload to AssemblyAI to get transcript ID
        console.log('📤 Uploading transcript to AssemblyAI...');
        const transcript = await assemblyClient.transcripts.transcribe({
            audio: audioFile.file_path
        });
        
        const assemblyTranscriptId = transcript.id;
        console.log(`✅ AssemblyAI Transcript ID: ${assemblyTranscriptId}`);
        
        // Generate summary with LeMUR
        const summaryResult = await generateSummaryWithLeMUR(assemblyTranscriptId, custom_prompt);
        
        // Parse summary into sections
        const summaryText = summaryResult.summary;
        const sections = parseSummary(summaryText);
        
        // Save to database
        const savedSummary = await queryOne(
            `INSERT INTO meeting_summaries 
             (meeting_id, key_points, action_items, decisions_made, created_by, updated_by, ai_generated)
             VALUES ($1, $2, $3, $4, $5, $5, true)
             ON CONFLICT (meeting_id) 
             DO UPDATE SET 
                 key_points = $2,
                 action_items = $3,
                 decisions_made = $4,
                 updated_by = $5,
                 ai_generated = true
             RETURNING *`,
            [
                meeting_id,
                sections.keyPoints || summaryText,
                sections.actionItems || '',
                sections.decisions || '',
                req.userId
            ]
        );
        
        console.log('✅ AI summary generated and saved');
        
        res.json({
            success: true,
            message: 'AI summary generated successfully',
            data: {
                summary: savedSummary,
                raw_response: summaryText,
                usage: summaryResult.usage
            }
        });
        
    } catch (error) {
        console.error('❌ Generate summary error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

/**
 * Ask questions about meeting
 */
app.post('/api/summary/questions', authMiddleware, async (req, res) => {
    try {
        const { meeting_id, questions } = req.body;
        
        if (!meeting_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Meeting ID required' 
            });
        }
        
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Questions array required' 
            });
        }
        
        console.log(`💬 Processing ${questions.length} questions for meeting ${meeting_id}...`);
        
        // Get audio file
        const audioFile = await queryOne(
            'SELECT * FROM audio_files WHERE meeting_id = $1 AND processed = true ORDER BY uploaded_at DESC LIMIT 1',
            [meeting_id]
        );
        
        if (!audioFile) {
            return res.status(400).json({ 
                success: false, 
                error: 'No processed audio file found' 
            });
        }
        
        // Get AssemblyAI transcript ID (same workaround as above)
        const transcript = await assemblyClient.transcripts.transcribe({
            audio: audioFile.file_path
        });
        
        const assemblyTranscriptId = transcript.id;
        
        // Ask questions with LeMUR
        const qaResult = await askMeetingQuestions(assemblyTranscriptId, questions);
        
        console.log('✅ Q&A completed');
        
        res.json({
            success: true,
            message: 'Questions answered successfully',
            data: {
                answers: qaResult.answers,
                usage: qaResult.usage
            }
        });
        
    } catch (error) {
        console.error('❌ Q&A error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

/**
 * Helper function to parse LeMUR summary into sections
 */
function parseSummary(summaryText) {
    const sections = {
        keyPoints: '',
        actionItems: '',
        decisions: '',
        nextSteps: ''
    };
    
    try {
        // Try to parse structured sections
        const keyPointsMatch = summaryText.match(/KEY POINTS[:\s]+([\s\S]*?)(?=ACTION ITEMS|DECISIONS|NEXT STEPS|$)/i);
        const actionItemsMatch = summaryText.match(/ACTION ITEMS[:\s]+([\s\S]*?)(?=KEY POINTS|DECISIONS|NEXT STEPS|$)/i);
        const decisionsMatch = summaryText.match(/DECISIONS[:\s]+([\s\S]*?)(?=KEY POINTS|ACTION ITEMS|NEXT STEPS|$)/i);
        const nextStepsMatch = summaryText.match(/NEXT STEPS[:\s]+([\s\S]*?)(?=KEY POINTS|ACTION ITEMS|DECISIONS|$)/i);
        
        if (keyPointsMatch) sections.keyPoints = keyPointsMatch[1].trim();
        if (actionItemsMatch) sections.actionItems = actionItemsMatch[1].trim();
        if (decisionsMatch) sections.decisions = decisionsMatch[1].trim();
        if (nextStepsMatch) sections.nextSteps = nextStepsMatch[1].trim();
        
    } catch (error) {
        console.warn('Could not parse summary sections:', error);
    }
    
    return sections;
}

// ==================== SUMMARY API (MANUAL) ====================

app.post('/api/meetings/:id/summary', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { key_points, action_items, decisions_made, next_meeting_date, next_meeting_agenda } = req.body;
        
        const meeting = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, req.userId]
        );
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        const summary = await queryOne(
            `INSERT INTO meeting_summaries 
             (meeting_id, key_points, action_items, decisions_made, next_meeting_date, next_meeting_agenda, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
             ON CONFLICT (meeting_id) 
             DO UPDATE SET 
                 key_points = COALESCE($2, meeting_summaries.key_points),
                 action_items = COALESCE($3, meeting_summaries.action_items),
                 decisions_made = COALESCE($4, meeting_summaries.decisions_made),
                 next_meeting_date = COALESCE($5, meeting_summaries.next_meeting_date),
                 next_meeting_agenda = COALESCE($6, meeting_summaries.next_meeting_agenda),
                 updated_by = $7
             RETURNING *`,
            [id, key_points, action_items, decisions_made, next_meeting_date, next_meeting_agenda, req.userId]
        );
        
        await query(
            `UPDATE meetings 
             SET status = CASE WHEN status = 'draft' THEN 'completed' ELSE status END,
                 updated_by = $1
             WHERE id = $2`,
            [req.userId, id]
        );
        
        res.json({
            success: true,
            message: 'Summary saved successfully',
            data: summary
        });
    } catch (error) {
        console.error('❌ Save summary error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to save summary' 
        });
    }
});

// ==================== ENHANCED FEATURES API ====================

// Get meeting highlights
app.get('/api/meetings/:id/highlights', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify meeting ownership
        const meeting = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, req.userId]
        );

        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found'
            });
        }

        const highlights = await queryAll(
            `SELECT * FROM meeting_highlights
             WHERE meeting_id = $1 AND deleted_at IS NULL
             ORDER BY rank DESC, count DESC`,
            [id]
        );

        res.json({
            success: true,
            data: highlights
        });
    } catch (error) {
        console.error('❌ Get highlights error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch highlights'
        });
    }
});

// Get meeting sentiment analysis
app.get('/api/meetings/:id/sentiment', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify meeting ownership
        const meeting = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, req.userId]
        );

        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found'
            });
        }

        const sentimentData = await queryAll(
            `SELECT
                sentiment,
                sentiment_score,
                speaker,
                text,
                timestamp
             FROM transcripts
             WHERE meeting_id = $1 AND deleted_at IS NULL
             ORDER BY sequence_number, timestamp`,
            [id]
        );

        // Calculate overall sentiment
        const total = sentimentData.length;
        const positive = sentimentData.filter(s => s.sentiment === 'POSITIVE').length;
        const negative = sentimentData.filter(s => s.sentiment === 'NEGATIVE').length;
        const neutral = sentimentData.filter(s => s.sentiment === 'NEUTRAL').length;

        res.json({
            success: true,
            data: {
                overall: {
                    total,
                    positive,
                    negative,
                    neutral,
                    positivePercent: total > 0 ? Math.round((positive / total) * 100) : 0,
                    negativePercent: total > 0 ? Math.round((negative / total) * 100) : 0,
                    neutralPercent: total > 0 ? Math.round((neutral / total) * 100) : 0
                },
                details: sentimentData
            }
        });
    } catch (error) {
        console.error('❌ Get sentiment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sentiment analysis'
        });
    }
});

// Get meeting entities
app.get('/api/meetings/:id/entities', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify meeting ownership
        const meeting = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, req.userId]
        );

        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found'
            });
        }

        const entities = await queryAll(
            `SELECT * FROM meeting_entities
             WHERE meeting_id = $1 AND deleted_at IS NULL
             ORDER BY entity_type, start_time`,
            [id]
        );

        // Group by entity type
        const grouped = entities.reduce((acc, entity) => {
            const type = entity.entity_type || 'other';
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(entity);
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                all: entities,
                byType: grouped
            }
        });
    } catch (error) {
        console.error('❌ Get entities error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch entities'
        });
    }
});

// Get meeting chapters
app.get('/api/meetings/:id/chapters', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify meeting ownership
        const meeting = await queryOne(
            'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, req.userId]
        );

        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found'
            });
        }

        const chapters = await queryAll(
            `SELECT * FROM meeting_chapters
             WHERE meeting_id = $1 AND deleted_at IS NULL
             ORDER BY sequence_number, start_time`,
            [id]
        );

        res.json({
            success: true,
            data: chapters
        });
    } catch (error) {
        console.error('❌ Get chapters error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chapters'
        });
    }
});

// ==================== EXPORT API ====================

app.post('/api/export/pdf', authMiddleware, async (req, res) => {
    try {
        const { meeting_id } = req.body;
        
        if (!meeting_id) {
            return res.status(400).json({ 
                success: false,
                error: 'meeting_id required' 
            });
        }
        
        const meeting = await queryOne(
            'SELECT * FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [meeting_id, req.userId]
        );
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        const participants = await queryAll(
            'SELECT * FROM participants WHERE meeting_id = $1 AND deleted_at IS NULL ORDER BY created_at',
            [meeting_id]
        );
        
        const transcripts = await queryAll(
            'SELECT * FROM transcripts WHERE meeting_id = $1 AND deleted_at IS NULL ORDER BY sequence_number',
            [meeting_id]
        );
        
        const summary = await queryOne(
            'SELECT * FROM meeting_summaries WHERE meeting_id = $1 AND deleted_at IS NULL',
            [meeting_id]
        );
        
        console.log('📄 Generating PDF...');
        
        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=meeting-${meeting_id}-${Date.now()}.pdf`);
        
        doc.pipe(res);
        
        // Header
        doc.fontSize(24).fillColor('#00ff88').text('MEETING MINUTES', { align: 'center' });
        doc.moveDown();
        
        // Meeting Info
        doc.fontSize(14).fillColor('#00ffff').text('Meeting Information', { underline: true });
        doc.fontSize(11).fillColor('#000000')
           .text(`Title: ${meeting.title}`)
           .text(`Date: ${new Date(meeting.date).toLocaleString()}`)
           .text(`Location: ${meeting.location || 'N/A'}`)
           .text(`Status: ${meeting.status}`);
        doc.moveDown();
        
        // Participants
        doc.fontSize(14).fillColor('#00ffff').text('Participants', { underline: true });
        doc.fontSize(11).fillColor('#000000');
        participants.forEach((p, i) => {
            doc.text(`${i + 1}. ${p.name} ${p.role ? `(${p.role})` : ''} - ${p.email}`);
        });
        doc.moveDown();
        
        // Transcript
        if (transcripts && transcripts.length > 0) {
            doc.fontSize(14).fillColor('#00ffff').text('Transcript', { underline: true });
            doc.fontSize(10).fillColor('#000000');
            
            transcripts.forEach((t, index) => {
                doc.fillColor('#0066cc').text(`[${t.speaker}]:`, { continued: true })
                   .fillColor('#000000').text(` ${t.text}`);
                doc.moveDown(0.5);
                
                if ((index + 1) % 15 === 0 && index < transcripts.length - 1) {
                    doc.addPage();
                }
            });
        }
        
        // Summary
        if (summary) {
            doc.addPage();
            
            if (summary.key_points) {
                doc.fontSize(14).fillColor('#00ffff').text('Key Points', { underline: true });
                doc.fontSize(11).fillColor('#000000').text(summary.key_points);
                doc.moveDown();
            }
            
            if (summary.action_items) {
                doc.fontSize(14).fillColor('#00ffff').text('Action Items', { underline: true });
                doc.fontSize(11).fillColor('#000000').text(summary.action_items);
                doc.moveDown();
            }
            
            if (summary.decisions_made) {
                doc.fontSize(14).fillColor('#00ffff').text('Decisions Made', { underline: true });
                doc.fontSize(11).fillColor('#000000').text(summary.decisions_made);
                doc.moveDown();
            }
            
            if (summary.ai_generated) {
                doc.fontSize(10).fillColor('#666666')
                   .text('✨ AI-Generated Summary (Powered by AssemblyAI LeMUR)', { italic: true });
                doc.moveDown();
            }
        }
        
        // Footer
        doc.fontSize(8).fillColor('#666666')
           .text(`Generated by naraMeet ULTIMATE on ${new Date().toLocaleString()}`, 
                 50, doc.page.height - 50, { align: 'center' });
        
        doc.end();
        
        await query(
            `INSERT INTO exports (meeting_id, user_id, export_type, exported_at)
             VALUES ($1, $2, 'pdf', CURRENT_TIMESTAMP)`,
            [meeting_id, req.userId]
        );
        
    } catch (error) {
        console.error('❌ PDF export error:', error);
        res.status(500).json({ 
            success: false,
            error: 'PDF export failed' 
        });
    }
});

app.post('/api/export/docx', authMiddleware, async (req, res) => {
    try {
        const { meeting_id } = req.body;
        
        if (!meeting_id) {
            return res.status(400).json({ 
                success: false,
                error: 'meeting_id required' 
            });
        }
        
        const meeting = await queryOne(
            'SELECT * FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [meeting_id, req.userId]
        );
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        const participants = await queryAll(
            'SELECT * FROM participants WHERE meeting_id = $1 AND deleted_at IS NULL ORDER BY created_at',
            [meeting_id]
        );
        
        const transcripts = await queryAll(
            'SELECT * FROM transcripts WHERE meeting_id = $1 AND deleted_at IS NULL ORDER BY sequence_number',
            [meeting_id]
        );
        
        const summary = await queryOne(
            'SELECT * FROM meeting_summaries WHERE meeting_id = $1 AND deleted_at IS NULL',
            [meeting_id]
        );
        
        console.log('📝 Generating DOCX...');
        
        const children = [];
        
        // Header
        children.push(
            new Paragraph({
                text: 'MEETING MINUTES',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            })
        );
        
        // Meeting Info
        children.push(
            new Paragraph({
                text: 'Meeting Information',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 200 }
            })
        );
        
        children.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Title: ', bold: true }),
                    new TextRun(meeting.title)
                ]
            })
        );
        
        children.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Date: ', bold: true }),
                    new TextRun(new Date(meeting.date).toLocaleString())
                ]
            })
        );
        
        children.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Location: ', bold: true }),
                    new TextRun(meeting.location || 'N/A')
                ],
                spacing: { after: 200 }
            })
        );
        
        // Participants
        children.push(
            new Paragraph({
                text: 'Participants',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 200 }
            })
        );
        
        participants.forEach((p, i) => {
            children.push(
                new Paragraph({
                    text: `${i + 1}. ${p.name} ${p.role ? `(${p.role})` : ''} - ${p.email}`,
                    spacing: { after: 100 }
                })
            );
        });
        
        // Transcript
        if (transcripts && transcripts.length > 0) {
            children.push(
                new Paragraph({
                    text: 'Transcript',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 }
                })
            );
            
            transcripts.forEach(t => {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `[${t.speaker}]: `, bold: true, color: '0066cc' }),
                            new TextRun(t.text)
                        ],
                        spacing: { after: 150 }
                    })
                );
            });
        }
        
        // Summary
        if (summary) {
            if (summary.key_points) {
                children.push(
                    new Paragraph({
                        text: 'Key Points',
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 400, after: 200 }
                    })
                );
                children.push(
                    new Paragraph({
                        text: summary.key_points,
                        spacing: { after: 200 }
                    })
                );
            }
            
            if (summary.action_items) {
                children.push(
                    new Paragraph({
                        text: 'Action Items',
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 200 }
                    })
                );
                children.push(
                    new Paragraph({
                        text: summary.action_items,
                        spacing: { after: 200 }
                    })
                );
            }
            
            if (summary.decisions_made) {
                children.push(
                    new Paragraph({
                        text: 'Decisions Made',
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 200 }
                    })
                );
                children.push(
                    new Paragraph({
                        text: summary.decisions_made,
                        spacing: { after: 200 }
                    })
                );
            }
            
            if (summary.ai_generated) {
                children.push(
                    new Paragraph({
                        text: '✨ AI-Generated Summary (Powered by AssemblyAI LeMUR)',
                        italics: true,
                        spacing: { before: 200 }
                    })
                );
            }
        }
        
        const doc = new Document({
            sections: [{
                properties: {},
                children: children
            }]
        });
        
        const buffer = await Packer.toBuffer(doc);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=meeting-${meeting_id}-${Date.now()}.docx`);
        res.send(buffer);
        
        await query(
            `INSERT INTO exports (meeting_id, user_id, export_type, exported_at)
             VALUES ($1, $2, 'docx', CURRENT_TIMESTAMP)`,
            [meeting_id, req.userId]
        );
        
    } catch (error) {
        console.error('❌ DOCX export error:', error);
        res.status(500).json({ 
            success: false,
            error: 'DOCX export failed' 
        });
    }
});

// ==================== N8N WEBHOOK ====================

app.post('/api/send-minutes', authMiddleware, async (req, res) => {
    try {
        const { meeting_id, webhookUrl } = req.body;
        
        if (!webhookUrl) {
            return res.status(400).json({ 
                success: false,
                error: 'Webhook URL required' 
            });
        }
        
        if (!meeting_id) {
            return res.status(400).json({ 
                success: false,
                error: 'meeting_id required' 
            });
        }
        
        const meeting = await queryOne(
            'SELECT * FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [meeting_id, req.userId]
        );
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        const participants = await queryAll(
            'SELECT * FROM participants WHERE meeting_id = $1 AND deleted_at IS NULL',
            [meeting_id]
        );
        
        const transcripts = await queryAll(
            'SELECT * FROM transcripts WHERE meeting_id = $1 AND deleted_at IS NULL ORDER BY sequence_number',
            [meeting_id]
        );
        
        const summary = await queryOne(
            'SELECT * FROM meeting_summaries WHERE meeting_id = $1 AND deleted_at IS NULL',
            [meeting_id]
        );
        
        console.log('📨 Sending to N8N webhook...');
        
        const payload = {
            meeting: meeting,
            participants: participants,
            transcript: transcripts,
            summary: summary,
            timestamp: new Date().toISOString(),
            source: 'narameet_ultimate',
            ai_powered: summary?.ai_generated || false
        };
        
        const response = await axios.post(webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        
        res.json({
            success: true,
            message: 'Data sent to N8N successfully',
            n8nResponse: response.data
        });
        
    } catch (error) {
        console.error('❌ N8N webhook error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to send to N8N',
            details: error.message 
        });
    }
});

// ==================== EMAIL API ====================

app.post('/api/send-email', authMiddleware, async (req, res) => {
    try {
        const { meeting_id, include_attachment = true } = req.body;
        
        if (!meeting_id) {
            return res.status(400).json({ 
                success: false,
                error: 'meeting_id required' 
            });
        }
        
        if (!emailTransporter) {
            return res.status(503).json({ 
                success: false,
                error: 'Email service not configured. Please set SMTP credentials in .env file.' 
            });
        }
        
        const meeting = await queryOne(
            'SELECT * FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [meeting_id, req.userId]
        );
        
        if (!meeting) {
            return res.status(404).json({ 
                success: false,
                error: 'Meeting not found' 
            });
        }
        
        const participants = await queryAll(
            'SELECT * FROM participants WHERE meeting_id = $1 AND deleted_at IS NULL',
            [meeting_id]
        );
        
        if (participants.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'No participants to send email to' 
            });
        }
        
        const transcripts = await queryAll(
            'SELECT * FROM transcripts WHERE meeting_id = $1 AND deleted_at IS NULL ORDER BY sequence_number',
            [meeting_id]
        );
        
        const summary = await queryOne(
            'SELECT * FROM meeting_summaries WHERE meeting_id = $1 AND deleted_at IS NULL',
            [meeting_id]
        );
        
        console.log(`📧 Sending emails to ${participants.length} participants...`);
        
        const results = await sendMeetingMinutesEmail(meeting, participants, transcripts, summary);
        
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
        
        res.json({
            success: true,
            message: `Emails sent: ${successCount} successful, ${failedCount} failed`,
            results: results
        });
        
    } catch (error) {
        console.error('❌ Send email error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to send emails',
            details: error.message 
        });
    }
});


// ==================== JITSI MEETING ENDPOINTS ====================

/**
 * Generate JWT token for meeting
 */
app.post('/api/jitsi/token', authMiddleware, async (req, res) => {
    try {
        const { meeting_id, room_name, user_name, is_moderator } = req.body;

        if (!room_name || !user_name) {
            return res.status(400).json({
                success: false,
                error: 'room_name and user_name are required'
            });
        }

        // Get user info
        const user = await queryOne(
            'SELECT * FROM users WHERE id = $1',
            [req.userId]
        );

        const token = generateJitsiToken({
            roomName: room_name,
            userName: user_name || user.name,
            userEmail: user.email,
            isModerator: is_moderator || false,
            expiresIn: 7200 // 2 hours
        });

        // If meeting_id provided, save token to database
        if (meeting_id) {
            await query(
                `UPDATE meetings 
                 SET jitsi_room_name = $1, 
                     jitsi_token = $2,
                     status = 'in_progress'
                 WHERE id = $3 AND user_id = $4`,
                [room_name, token, meeting_id, req.userId]
            );
        }

        const tenant = process.env.JITSI_APP_ID.replace('vpaas-magic-cookie-', '');

        res.json({
            success: true,
            data: {
                token: token,
                roomName: room_name,
                meetingUrl: `https://8x8.vc/${tenant}/${encodeURIComponent(room_name)}`,
                appId: process.env.JITSI_APP_ID,
                expiresIn: 7200
            }
        });

    } catch (error) {
        console.error('❌ Generate Jitsi token error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== JITSI MEETING ENDPOINTS ====================

/**
 * Get meeting URL with JWT (Allow owner AND participants)
 */
app.get('/api/jitsi/meeting-url/:meetingId', authMiddleware, async (req, res) => {
    try {
        const { meetingId } = req.params;
        
        console.log(`🔍 User ${req.userId} requesting meeting URL for meeting ${meetingId}`);
        
        const user = await queryOne(
            'SELECT * FROM users WHERE id = $1',
            [req.userId]
        );
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // ✅ FIX: Check owner OR participant
        const meetingCheck = await query(
            `SELECT m.*, 
                    CASE WHEN m.user_id = $2 THEN true ELSE false END as is_owner,
                    CASE WHEN p.email = $3 THEN true ELSE false END as is_participant
             FROM meetings m
             LEFT JOIN participants p ON m.id = p.meeting_id AND p.email = $3 AND p.deleted_at IS NULL
             WHERE m.id = $1 AND m.deleted_at IS NULL`,
            [meetingId, req.userId, user.email]
        );
        
        if (meetingCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found'
            });
        }
        
        const meeting = meetingCheck.rows[0];
        
        // ✅ ALLOW access if owner OR participant
        if (!meeting.is_owner && !meeting.is_participant) {
            return res.status(403).json({
                success: false,
                error: 'You are not invited to this meeting'
            });
        }
        
        console.log(`✅ Access granted (Owner: ${meeting.is_owner}, Participant: ${meeting.is_participant})`);
        
        // ✅ Get or create room name
        let roomName = meeting.jitsi_room_name;
        
        if (!roomName) {
            roomName = `narameet-${meetingId}-${Date.now()}`;
            console.log(`✅ Creating new room: ${roomName}`);
            
            await query(
                'UPDATE meetings SET jitsi_room_name = $1, status = $2 WHERE id = $3',
                [roomName, 'in_progress', meetingId]
            );
        }
        
        console.log(`🚪 Using room: "${roomName}"`);
        
        // ✅ CRITICAL: Owner = ALWAYS moderator, Participant = guest
        const isModerator = meeting.is_owner === true;  // ← HARUS BOOLEAN TRUE!
        
        console.log(`🎥 Generating URL for "${user.name}" (Moderator: ${isModerator})`);
        
        // ✅ Generate URL
        const meetingUrl = generateMeetingUrl(
            roomName,
            user.name || user.username,
            {
                userEmail: user.email,
                isModerator: isModerator  // ← Owner = true, Others = false
            }
        );
        
        console.log(`✅ Meeting URL generated successfully`);
        
        res.json({
            success: true,
            data: meetingUrl
        });
        
    } catch (error) {
        console.error('❌ Get meeting URL error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Create quick meeting (instant meeting without setup)
 */
app.post('/api/jitsi/quick-meeting', authMiddleware, async (req, res) => {
    try {
        const { room_name, meeting_title } = req.body;

        const user = await queryOne(
            'SELECT * FROM users WHERE id = $1',
            [req.userId]
        );

        // Create meeting record
        const meeting = await queryOne(
            `INSERT INTO meetings (user_id, title, date, status, created_by)
             VALUES ($1, $2, CURRENT_TIMESTAMP, 'in_progress', $1)
             RETURNING *`,
            [req.userId, meeting_title || 'Quick Meeting']
        );

        const generatedRoomName = room_name || `narameet-${meeting.id}-${Date.now()}`;

        const meetingUrl = generateMeetingUrl(
            generatedRoomName,
            user.name || user.username,
            {
                userEmail: user.email,
                isModerator: true
            }
        );

        // Update meeting with Jitsi info
        await query(
            `UPDATE meetings 
             SET jitsi_room_name = $1, jitsi_token = $2
             WHERE id = $3`,
            [generatedRoomName, meetingUrl.token, meeting.id]
        );

        res.json({
            success: true,
            message: 'Quick meeting created',
            data: {
                meeting_id: meeting.id,
                ...meetingUrl
            }
        });

    } catch (error) {
        console.error('❌ Quick meeting error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

console.log('🎥 Jitsi Meeting endpoints registered');


// ==================== STATUS ENDPOINTS ====================

app.get('/api/assemblyai-status', async (req, res) => {
    try {
        // Test AssemblyAI connection
        const testTranscript = await assemblyClient.transcripts.list({ limit: 1 });
        
        res.json({
            success: true,
            status: 'connected',
            message: 'AssemblyAI API is working',
            features: {
                transcription: true,
                speaker_diarization: true,
                lemur_summary: true,
                multilingual: true
            }
        });
    } catch (error) {
        res.json({
            success: false,
            status: 'error',
            error: error.message
        });
    }
});

app.get('/api/db-status', authMiddleware, async (req, res) => {
    try {
        const stats = await queryOne(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as users_count,
                (SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL) as meetings_count,
                (SELECT COUNT(*) FROM participants WHERE deleted_at IS NULL) as participants_count,
                (SELECT COUNT(*) FROM transcripts WHERE deleted_at IS NULL) as transcripts_count,
                (SELECT COUNT(*) FROM exports WHERE deleted_at IS NULL) as exports_count
        `);
        
        res.json({
            success: true,
            status: 'connected',
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'error',
            error: error.message
        });
    }
});


// ==================== AUDIO FILE ENDPOINTS ====================
app.get('/api/audio/:id/download', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const audioFile = await queryOne(
            `SELECT af.*, m.user_id 
             FROM audio_files af
             JOIN meetings m ON af.meeting_id = m.id
             WHERE af.id = $1 AND af.deleted_at IS NULL`,
            [id]
        );
        
        if (!audioFile) {
            return res.status(404).json({ success: false, error: 'Audio file not found' });
        }
        
        // Check permission
        if (audioFile.user_id !== req.userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }
        
        // Serve file
        const filePath = audioFile.file_path;
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found on disk' });
        }
        
        res.setHeader('Content-Type', audioFile.mime_type || 'audio/wav');
        res.setHeader('Content-Disposition', `attachment; filename="${audioFile.original_filename}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('❌ Audio download error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/audio/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const audioFile = await queryOne(
            `SELECT af.*, m.user_id 
             FROM audio_files af
             JOIN meetings m ON af.meeting_id = m.id
             WHERE af.id = $1 AND af.deleted_at IS NULL`,
            [id]
        );
        
        if (!audioFile) {
            return res.status(404).json({ success: false, error: 'Audio file not found' });
        }
        
        if (audioFile.user_id !== req.userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }
        
        // Soft delete
        await query('UPDATE audio_files SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
        
        // Optionally delete file from disk
        try {
            if (fs.existsSync(audioFile.file_path)) {
                fs.unlinkSync(audioFile.file_path);
            }
        } catch (delError) {
            console.warn('Could not delete file from disk:', delError);
        }
        
        res.json({ success: true, message: 'Audio file deleted' });
        
    } catch (error) {
        console.error('❌ Audio delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// ==================== PUBLIC MEETING ACCESS (NO AUTH) ====================
app.get('/api/public/meeting/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const meeting = await queryOne(
            `SELECT id, title, date, jitsi_room_name, status 
             FROM meetings 
             WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );
        
        if (!meeting) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }
        
        res.json({ success: true, data: meeting });
        
    } catch (error) {
        console.error('❌ Public meeting error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/public/jitsi/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { guest_name = 'Guest', guest_email = '' } = req.query;
        
        console.log(`👤 Guest "${guest_name}" requesting join for meeting ${meetingId}`);
        
        const meeting = await queryOne(
            'SELECT * FROM meetings WHERE id = $1 AND deleted_at IS NULL',
            [meetingId]
        );
        
        if (!meeting) {
            console.error('❌ Meeting not found:', meetingId);
            return res.status(404).json({ 
                success: false, 
                error: 'Meeting not found' 
            });
        }
        
        // ✅ Use existing room name (MUST match moderator!)
        let roomName = meeting.jitsi_room_name;
        
        if (!roomName) {
            roomName = `narameet-${meetingId}-${Date.now()}`;
            console.log(`✅ Creating room for guest: ${roomName}`);
            
            await query(
                'UPDATE meetings SET jitsi_room_name = $1, status = $2 WHERE id = $3',
                [roomName, 'in_progress', meetingId]
            );
        }
        
        console.log(`🚪 Guest joining room: "${roomName}"`);
        
        // ✅ Guest = NON-moderator (false)
        const meetingUrl = generateMeetingUrl(
            roomName,
            guest_name,
            {
                userEmail: guest_email,
                isModerator: false  // ← Guest ALWAYS false!
            }
        );
        
        console.log(`✅ Guest URL generated (Moderator: false)`);
        
        res.json({ 
            success: true, 
            data: meetingUrl 
        });
        
    } catch (error) {
        console.error('❌ Public Jitsi error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});



// Root redirect
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// ==================== ERROR HANDLING ====================

app.use((req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'Endpoint not found' 
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});


process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing server...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing server...');
    await pool.end();
    process.exit(0);
});

// ==================== SETUP ENHANCEMENTS ====================

// ✅ Setup all enhanced endpoints (SRT/VTT, Word Search, Highlights, Entities, Chapters, etc.)
enhancements.setupEnhancements(app, assemblyClient, authMiddleware, query, queryOne, uploadRecording);

console.log('✅ Enhanced endpoints configured');

// ==================== START SERVER ====================

app.listen(PORT, HOST, () => {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   ⚡ naraMEET v2.0 ULTIMATE - AssemblyAI Edition ⚡       ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  🌐 Server: http://${HOST}:${PORT}                            ║`);
    console.log('║  🤖 AI Provider: AssemblyAI (Speech-to-Text + LeMUR)      ║');
    console.log('║  🎤 Speaker Diarization: Enabled                           ║');
    console.log('║  ✨ AI Summary: Enabled (Claude Sonnet 4)                  ║');
    console.log('║  🔐 Auth: ' + (ENABLE_AUTH ? 'Enabled                    ' : 'Disabled                   ') + '║');
    console.log('║  🗄️  Database: PostgreSQL (Connected)                      ║');
    console.log('║  📄 PDF Export: Ready                                      ║');
    console.log('║  📝 DOCX Export: Ready                                     ║');
    console.log('║  📧 Email: ' + (emailTransporter ? 'Enabled                    ' : 'Disabled                   ') + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  🔑 Default Login:                                         ║');
    console.log('║     Username: admin                                        ║');
    console.log('║     Password: admin123                                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
});

// Start HTTPS server (for microphone access on LAN)
try {
    const privateKey = fs.readFileSync('/app/ssl-certs/server.key', 'utf8');
    const certificate = fs.readFileSync('/app/ssl-certs/server.crt', 'utf8');
    const credentials = { key: privateKey, cert: certificate };

    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(HTTPS_PORT, HOST, () => {
        console.log(`╔════════════════════════════════════════════════════════════╗`);
        console.log(`║  🔒 HTTPS Server: https://${HOST}:${HTTPS_PORT}                   ║`);
        console.log(`║  📱 Mobile Access: https://192.168.1.20:${HTTPS_PORT}             ║`);
        console.log(`║  🎤 Microphone access enabled on HTTPS                     ║`);
        console.log(`╚════════════════════════════════════════════════════════════╝\n`);
    });
} catch (error) {
    console.log('⚠️  HTTPS not available (SSL certificates not found)');
    console.log('   Recording will only work on http://localhost:8000');
    console.log('   Error details:', error.message); // ← TAMBAH INI untuk debug
}

module.exports = app;