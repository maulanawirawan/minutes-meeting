# 🐛 PR Backlog & Feature Requests

> **Dibuat:** 30 April 2026
> **Status:** Pending — di-handle di sesi berikutnya setelah register wizard live

Daftar bug + feature request hasil testing register wizard sprint 1. Disusun berdasarkan **prioritas** (Critical → High → Medium → Future).

---

## 🚨 CRITICAL — Bug yang Blocking

### PR-01: Logout / Sign Out tidak berfungsi
**Severity:** 🔴 Critical
**Reported:** 30 Apr 2026

**Gejala:**
- Tekan tombol "Keluar" / "Sign Out" — tidak ada respons visual
- Tidak redirect ke halaman login
- User harus buka tab baru + masukkan link lagi untuk login ulang
- Bug terjadi di **kedua role**: Pasien dan Co-Ass

**Expected:**
- Klik tombol logout → JWT di localStorage dihapus → state user reset → redirect ke `loginScreen`
- Idealnya ada konfirmasi dialog "Yakin keluar?"
- Toast feedback "Berhasil keluar"

**Hipotesis Lokasi Bug:**
- `server/public/index.html` — handler logout button (cari fungsi `doLogout()` atau `logout()`)
- Kemungkinan: event listener tidak ter-bind, atau localStorage clear gak di-followup dengan UI state reset
- Cek juga: socket disconnect setelah logout (avoid leaking sessions)

**Acceptance Criteria:**
- [ ] Klik logout → confirm dialog muncul (optional)
- [ ] Konfirmasi → JWT dihapus dari localStorage
- [ ] Socket.IO disconnect properly
- [ ] UI redirect ke `loginScreen` dengan animasi smooth
- [ ] Toast "Berhasil keluar"
- [ ] Refresh page → tetap di login (bukan auto-logged in)

---

## 🔴 HIGH — Role-Based Access & Connection Flow

### PR-02: Pasien tidak boleh "Connect" ke Co-Ass
**Severity:** 🔴 High
**Reported:** 30 Apr 2026

**Gejala:**
- Saat login sebagai **Pasien**, ada tombol "Connect" / "Hubungi" di card Co-Ass
- Pasien bisa initiate koneksi ke Co-Ass
- Padahal seharusnya **hanya Co-Ass** yang bisa "claim" atau "connect" ke Pasien

**Rasional Bisnis:**
- **Co-Ass yang butuh case** untuk requirement studi (kepaniteraan)
- **Pasien** adalah pasif — menunggu Co-Ass yang menawarkan diri
- Mirip seperti aplikasi rideshare: driver yang accept order, bukan penumpang yang "connect" ke driver

**Expected Behavior:**
- **Pasien view (browse Co-Ass list):**
  - Hanya tombol "👀 Lihat Profil" (read-only)
  - Tidak ada tombol Connect / Hubungi
  - Bisa lihat rating, spesialisasi, kampus, tapi pasif
- **Co-Ass view (browse Pasien list):**
  - Ada tombol "🤝 Tangani Kasus Ini" / "Tawarkan Diri"
  - Co-Ass yang initiate kontak
  - Setelah klik → masuk ke flow approval (lihat PR-03)

**Lokasi Code (estimasi):**
- `server/public/index.html` — render card list (`renderCoassList`, `renderPatientList`)
- `server/routes/users.js` — endpoint connect/match
- Conditional render tombol berdasarkan `user.role`

**Acceptance Criteria:**
- [ ] Pasien tidak melihat tombol "Connect" di Co-Ass card
- [ ] Co-Ass melihat tombol "Tangani Kasus" di Patient card
- [ ] Backend juga reject kalau Pasien hit endpoint `/api/match/connect` (defense in depth)
- [ ] UI consistency: copy text di tombol jelas (mis. "Tawarkan Bantuan" untuk Co-Ass)

---

### PR-03: Connection Flow — Approval & Auto Chatroom
**Severity:** 🔴 High
**Reported:** 30 Apr 2026

**Gejala saat ini:**
- Saat Co-Ass klik "Connect" ke Pasien → entah apa yang terjadi (tidak jelas feedback-nya)
- Tidak ada notifikasi ke Pasien
- Tidak ada permintaan persetujuan
- Tidak auto-redirect ke chatroom

**Expected Flow:**

```
1. Co-Ass klik "Tangani Kasus Ini" di card Pasien Sari
   ↓
2. Modal/dialog: "Tawarkan diri sebagai Co-Ass untuk Pasien Sari?"
   - Optional: input pesan singkat ke pasien
   - "Saya bisa menangani kasus gigi sensitif Anda"
   ↓
3. Co-Ass klik "Kirim Tawaran"
   ↓
4. Backend create record di collection `connections` atau `match_requests`:
   {
     coass_id, patient_id, status: 'pending',
     message, created_at
   }
   ↓
5. Push notification ke Pasien (Socket.IO realtime + persistent in-app):
   "🩺 Co-Ass Andi (FKG UI, Konservasi) ingin menangani kasus Anda"
   [Lihat Profil]  [Tolak]  [Setujui]
   ↓
6. Pasien klik "Setujui"
   ↓
7. Backend update status: 'accepted'
   ↓
8. Auto-create chatroom (jika belum ada)
   ↓
9. Both users di-redirect / di-notify untuk masuk ke chatroom
   "✅ Koneksi berhasil! Mulai chat dengan Co-Ass Andi"
   ↓
10. Chatroom terbuka, history kosong, ready to chat
```

**Komponen Baru yang Dibutuhkan:**

#### Backend
- [ ] Model `ConnectionRequest` (atau extend existing `Match` model)
  ```js
  {
    coassId: ObjectId,
    patientId: ObjectId,
    status: 'pending' | 'accepted' | 'rejected' | 'expired',
    initialMessage: String,
    createdAt: Date,
    respondedAt: Date,
    chatRoomId: ObjectId (set when accepted)
  }
  ```
- [ ] Endpoint `POST /api/connections/request` — Co-Ass kirim request
- [ ] Endpoint `POST /api/connections/:id/respond` — Pasien accept/reject
- [ ] Endpoint `GET /api/connections/incoming` — Pasien list pending requests
- [ ] Endpoint `GET /api/connections/outgoing` — Co-Ass list pending requests
- [ ] Socket.IO event: `connection:new`, `connection:accepted`, `connection:rejected`

#### Frontend
- [ ] Modal "Tawarkan Diri" di card Pasien (Co-Ass view)
- [ ] Notification panel / inbox untuk Pasien (incoming requests)
- [ ] Toast realtime saat ada request masuk
- [ ] Auto-redirect ke chatroom saat accepted
- [ ] Empty state di list — Pasien yang udah di-claim oleh Co-Ass A jangan muncul lagi di list (atau ada badge "sudah ditangani")

**Acceptance Criteria:**
- [ ] Co-Ass kirim request → Pasien dapat notif realtime (max 2 detik)
- [ ] Pasien approve → chatroom otomatis dibuat & dibuka untuk kedua pihak
- [ ] Pasien tolak → Co-Ass dapat notif "Permintaan ditolak"
- [ ] Request kadaluwarsa setelah 24 jam (status: 'expired')
- [ ] Audit log entry untuk setiap perubahan status

---

### PR-04: Co-Ass tidak boleh melihat List Co-Ass Lain
**Severity:** 🟠 High
**Reported:** 30 Apr 2026

**Gejala saat ini:**
- Login sebagai Co-Ass → bisa lihat **list Pasien** (✅ benar) **DAN list Co-Ass lain** (❌ salah)

**Expected:**
- Co-Ass hanya melihat list **Pasien** untuk klaim kasus
- ✅ Pasien hanya melihat list **Co-Ass** untuk preview profil (sudah benar)

**Lokasi Code:**
- `server/public/index.html` — fungsi render list utama
- `server/routes/users.js` — endpoint `/api/users` filter by `role` query param

**Acceptance Criteria:**
- [ ] Co-Ass UI: tab/list yang muncul hanya "Pasien"
- [ ] Backend: endpoint `/api/users?role=...` validate apakah requester boleh akses (RBAC)
- [ ] Default view saat Co-Ass login: list Pasien dengan filter spesialisasi yang relevan

---

## 🟡 MEDIUM — Feature Improvements

### PR-05: Tooth Map Visualization Lebih Realistis & Intuitif
**Severity:** 🟡 Medium
**Reported:** 30 Apr 2026

**Gejala saat ini:**
- SVG tooth map terlalu abstract (rectangles + simple shapes)
- User bingung mana view atas/bawah, mana gigi yang mana
- Tidak jelas perspective view-nya

**Expected:**
- **Anatomi gigi yang lebih realistis** — bukan kotak, tapi sesuai bentuk asli (incisor, canine, premolar, molar punya bentuk berbeda)
- **Label perspektif yang jelas:**
  - "Rahang Atas (Maxilla)" + "Rahang Bawah (Mandibula)"
  - Indicator kanan/kiri (dari sudut pandang pasien — mirror image)
  - Diagram kecil "Anda melihat dari arah pemeriksa" sebagai legend
- **Interaktif yang lebih informatif:**
  - Hover → tooltip dengan nomor FDI + nama lokal ("Gigi seri kanan atas / FDI 11")
  - Klik → modal detail dengan zoom + body location indicator
  - Cycle pain level tetap (3 → 5 → 7 → 9 → off)
- **Color-coded zones:**
  - Anterior (depan): incisors + canines — biasanya untuk estetika
  - Posterior (belakang): premolars + molars — biasanya untuk masalah kunyah

**Pilihan Implementasi:**

#### Opsi A — SVG path realistic per tooth type
- Buat 4 base shapes: incisor, canine, premolar, molar
- Mirror untuk kanan/kiri
- Total: 32 SVG paths dengan attribute `data-tooth="11"`, dst (FDI notation)
- **Pro:** lightweight, full control
- **Con:** butuh effort design

#### Opsi B — Pakai library existing
- **`dental-chart-svg`** (npm) — tapi limited customization
- **`react-dental-chart`** — kalau pindah ke React (overkill untuk sekarang)
- **Custom SVG dari Figma** — designer export, kita import

#### Opsi C — Anatomy diagram dengan callout marker
- Background: foto/illustration realistic mulut/gigi (creative commons)
- Overlay: clickable transparent regions per tooth
- **Pro:** super realistic
- **Con:** image asset butuh dicari/dibuat, kurang flexible

**Rekomendasi:** Opsi A dengan SVG paths realistic. Reference design:
- Search "dental chart FDI" untuk inspirasi
- 32 gigi total: 8 anterior atas, 8 anterior bawah (kalau pakai posisi M3 included)
- Notation FDI dua digit (11-18, 21-28, 31-38, 41-48)

**Tambahan UX:**
- [ ] Toggle "Tampilan Atas Saja" / "Tampilan Bawah Saja" / "Keduanya"
- [ ] Mini tutorial tooltip saat pertama kali user buka step keluhan
- [ ] "Tunjukkan saya cara baca diagram ini" link → popup edukasi singkat

**Acceptance Criteria:**
- [ ] Bentuk tiap gigi reflective dari jenisnya (visually distinguishable)
- [ ] Label rahang atas/bawah jelas
- [ ] Hover tooltip menampilkan nomor FDI + nama gigi
- [ ] User testing: minimal 5 orang awam paham dalam 30 detik tanpa instruksi

---

## 🔵 FUTURE — Feature Aspirational

### PR-06: Clustering Geografis & "Sosial Proof" LinkedIn-Style
**Severity:** 🔵 Future
**Reported:** 30 Apr 2026

**Konsep dari User:**
> *"Misalnya nih: +9 orang Universitas Indonesia mu bekerja di perusahaan Grab. Jadi nanti si patient itu yang akan dirujuk ke satu rumah sakit itu. Jadi ini nanti kayak clustering gitu per-daerah atau per-kota gitu kali ya."*

**Interpretation:**
- **Clustering** Co-Ass berdasarkan kampus / RSGM tempat praktek
- **Pasien preview:** "Co-Ass A & 12 lainnya dari **FKG Universitas Indonesia** praktek di **RSGM UI Salemba**"
- Pasien dapat **referensi RSGM** spesifik untuk follow-up offline kalau dibutuhkan
- Membantu pasien **kategorisasi & familiaritas** (oh, semua dari kampus yang sama, bisa dipercaya)

**Implementasi (Big Picture):**

#### Schema Update
```js
User.coass = {
  ...
  university: 'Universitas Indonesia',
  faculty: 'FKG',
  hospital: {
    name: 'RSGM UI Salemba',
    city: 'Jakarta',
    address: '...',
    coordinates: [lat, lng]
  },
  graduation_year: 2026
}
```

#### UI Patterns
- **Profile card Co-Ass** menampilkan:
  ```
  ┌─────────────────────────────────────┐
  │ 👤 dr. Co-Ass Andi P., S.KG       │
  │ FKG Universitas Indonesia · 2026  │
  │ 🏥 RSGM UI Salemba, Jakarta       │
  │ 👥 +24 Co-Ass lain dari kampus mu │
  │ ⭐ 4.8 · 12 kasus selesai          │
  └─────────────────────────────────────┘
  ```
- **Cluster badge** di list view: "🎓 12 dari FKG UI"
- **Filter** by kampus / kota / RSGM

#### Map View (MapLibre)
- Page baru `/map-rsgm` — peta Indonesia dengan marker per RSGM
- Klik marker → daftar Co-Ass aktif di RSGM tersebut
- Heatmap density Co-Ass tersedia per kota

#### Recommendation Engine
- **Lokasi-aware match**: pasien Jakarta direkomendasi Co-Ass praktek di RSGM Jakarta
- **Universitas affinity**: pasien yang pernah ditangani Co-Ass FKG UI lebih cenderung di-suggest Co-Ass FKG UI lain (cohort effect)
- **Kapasitas RSGM**: kalau RSGM sudah penuh, suggest RSGM cluster lain

**Acceptance Criteria (untuk MVP):**
- [ ] User schema extended dengan `hospital` & `university` fields
- [ ] Multi-step register wizard (Step 2 Co-Ass) include picker RSGM (autocomplete dari list)
- [ ] Co-Ass card di list pasien tampilkan RSGM + cluster info
- [ ] Page `/cluster` — daftar RSGM dengan jumlah Co-Ass aktif

**Future Extension:**
- Partnership resmi dengan RSGM untuk import data Co-Ass otomatis
- Rating per RSGM (bukan hanya per individual Co-Ass)
- Statistik kasus per RSGM untuk Dinkes (anonim)

---

## 🔵 FUTURE — Sprint 2 dari Plan Awal

Selain bug di atas, masih ada **fitur yang sudah disetujui di sprint awal** tapi belum diimplementasikan:

### PR-07: AI Triage Concierge
**Status:** Belum dimulai
**Fitur:** Pre-consultation chatbot yang ngumpulin keluhan pasien sebelum match dengan Co-Ass. Hasilnya jadi "case brief" yang Co-Ass bisa baca sekilas.

### PR-08: SOAP Auto-Generation
**Status:** Belum dimulai
**Fitur:** Setelah konsultasi selesai, AI auto-generate SOAP note (Subjective, Objective, Assessment, Plan) dari transcript chat/video. Co-Ass tinggal review & edit.

### PR-09: Smart Match Algorithm
**Status:** Belum dimulai
**Fitur:** Match Co-Ass ↔ Pasien based on:
- Lokasi (PR-06 clustering)
- Spesialisasi vs keluhan (mis. ortho untuk kawat gigi, perio untuk gusi)
- Rating & track record
- Bahasa
- Budget pasien vs availability Co-Ass

### PR-10: Voice Memo Transcription
**Status:** Sudah ada UI di register wizard, butuh backend transcription
**Fitur:** Voice memo yang di-upload pasien (misal di register wizard step keluhan) di-transcribe otomatis ke teks pakai Web Speech API atau Whisper API. Hasil: searchable + bisa ditampilkan ke Co-Ass dalam bentuk teks.

### PR-11: Video Consultation Room
**Status:** Existing tapi belum tested end-to-end
**Fitur:** WebRTC video call antara Co-Ass & Pasien dengan:
- Recording (with consent)
- Screen share (Co-Ass tunjuk gambar referensi)
- Annotation tool
- Auto SOAP generation dari transcript

### PR-12: Notifications & Reminder System
**Status:** Belum dimulai
**Fitur:**
- Push notification (in-app + email/SMS) untuk:
  - Connection request masuk
  - Chat baru saat user offline
  - Janji konsultasi 1 jam sebelum
  - Follow-up reminder 3/7/14 hari setelah konsultasi

### PR-13: Rating & Review System
**Status:** Belum dimulai
**Fitur:**
- Pasien rating Co-Ass setelah selesai kasus (1-5 bintang + komentar)
- Display di profile Co-Ass
- Aggregate rating per RSGM / kampus
- Co-Ass juga bisa rate pasien (compliance, communication) — internal-only

---

## 📋 Sprint Planning Suggestions

Setelah register wizard live, urutan implementasi yang disarankan:

### Sprint 2A — Critical Bugs (1-2 hari)
- PR-01 Logout fix
- PR-02 Hide Connect button untuk pasien
- PR-04 Co-Ass tidak lihat list Co-Ass

### Sprint 2B — Connection Flow (3-4 hari)
- PR-03 Full approval flow + auto chatroom

### Sprint 2C — UI Polish (2-3 hari)
- PR-05 Realistic tooth map

### Sprint 3 — Aspirational (sesuai bandwidth)
- PR-06 Clustering & RSGM
- PR-07 AI Triage
- PR-08 SOAP Auto-Gen
- PR-09 Smart Match

---

## 🔖 Convention untuk Future PRs

Saat ada bug/feature baru, format entry:

```markdown
### PR-NN: [Judul Singkat]
**Severity:** 🔴 / 🟠 / 🟡 / 🔵
**Reported:** [Tanggal]

**Gejala:** ...
**Expected:** ...
**Lokasi Code:** ...
**Acceptance Criteria:**
- [ ] ...
```

Update file ini setiap testing baru. Jangan delete entry yang sudah selesai — cukup tandai `**Status:** ✅ DONE [tanggal]` di header-nya untuk historical tracking.
