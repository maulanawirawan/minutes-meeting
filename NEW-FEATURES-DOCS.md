# 🚀 NEW FEATURES DOCUMENTATION
## naraMEET v2.1 - Advanced AssemblyAI Features

Dokumentasi lengkap untuk fitur-fitur baru yang ditambahkan:
1. **Streaming API** - Real-time transcription dengan WebSocket
2. **Keyterms Prompting** - Meningkatkan akurasi untuk kata-kata khusus
3. **Speaker Identification** - Identifikasi speaker berdasarkan nama atau role
4. **Translation** - Menerjemahkan transkrip ke berbagai bahasa

---

## 📋 Table of Contents

1. [Streaming API (Real-time Transcription)](#1-streaming-api-real-time-transcription)
2. [Keyterms Prompting](#2-keyterms-prompting)
3. [Speaker Identification](#3-speaker-identification)
4. [Translation](#4-translation)
5. [Complete Workflow API](#5-complete-workflow-api)
6. [Best Practices](#6-best-practices)

---

## 1. Streaming API (Real-time Transcription)

### 🌊 Overview
Real-time speech-to-text dengan WebSocket untuk live meetings dan voice conversations.

### Features
- ✅ Real-time transcription dengan latency rendah
- ✅ Turn detection (deteksi akhir giliran bicara)
- ✅ Keyterms prompting (otomatis dari partisipan & meeting title)
- ✅ Multilingual support
- ✅ Word-level timestamps & confidence scores
- ✅ Auto-save ke database per turn

### WebSocket Endpoint
```
ws://localhost:3000/api/streaming/ws
```

### Message Protocol

#### 1. Start Session
**Client → Server:**
```json
{
  "type": "start_session",
  "meeting_id": 123,
  "user_id": 1,
  "sample_rate": 16000,
  "format_turns": true,
  "keyterms": ["John", "Project Alpha"],
  "language_code": "id",
  "turn_detection": "balanced"
}
```

**Turn Detection Options:**
- `"aggressive"` - Cepat, untuk voice agents
- `"balanced"` - Standar, untuk conversations
- `"conservative"` - Lambat, untuk thoughtful speech

**Server → Client:**
```json
{
  "type": "session_started",
  "session_id": "session_1234567890_abc123",
  "message": "Streaming session started successfully"
}
```

```json
{
  "type": "session_begin",
  "assembly_session_id": "de5d9927-73a6-4be8-b52d-b4c07be37e6b",
  "expires_at": 1759796682
}
```

#### 2. Stream Audio
**Client → Server:**
```json
{
  "type": "audio_data",
  "audio": "base64_encoded_audio_data"
}
```

**Server → Client (Real-time Turns):**
```json
{
  "type": "turn",
  "data": {
    "turn_order": 0,
    "transcript": "hi my name is",
    "utterance": "",
    "is_formatted": false,
    "end_of_turn": false,
    "confidence": 0.00545,
    "words": [
      {
        "start": 1920,
        "end": 2000,
        "text": "hi",
        "confidence": 0.874618,
        "word_is_final": true
      }
    ],
    "timestamp": 1705123456789
  }
}
```

**When utterance is complete:**
```json
{
  "type": "turn",
  "data": {
    "turn_order": 0,
    "transcript": "hi my name is sonny",
    "utterance": "Hi my name is sonny",
    "is_formatted": false,
    "end_of_turn": true,
    "confidence": 0.5005,
    "words": [...]
  }
}
```

#### 3. End Session
**Client → Server:**
```json
{
  "type": "end_session"
}
```

**Server → Client:**
```json
{
  "type": "session_ended",
  "message": "Streaming session ended",
  "session_data": {
    "sessionId": "session_1234567890_abc123",
    "meetingId": 123,
    "startTime": 1705123456789,
    "endTime": 1705123556789,
    "duration": 100000,
    "transcripts": [...],
    "turns": [...]
  }
}
```

### JavaScript Client Example

```javascript
const ws = new WebSocket('ws://localhost:3000/api/streaming/ws');

ws.onopen = () => {
  // Start session
  ws.send(JSON.stringify({
    type: 'start_session',
    meeting_id: 123,
    user_id: 1,
    sample_rate: 16000,
    format_turns: true,
    turn_detection: 'balanced'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'session_started') {
    console.log('Session started:', data.session_id);
    startMicrophone(); // Start capturing audio
  }

  else if (data.type === 'turn') {
    const turn = data.data;

    // Partial transcript (real-time)
    if (!turn.is_formatted && !turn.end_of_turn) {
      updateLiveTranscript(turn.transcript);
    }

    // Utterance ready (for voice agents)
    if (turn.utterance && turn.utterance.length > 0) {
      processUtterance(turn.utterance);
    }

    // Final formatted turn
    if (turn.is_formatted && turn.end_of_turn) {
      addFinalTranscript(turn.transcript);
    }
  }

  else if (data.type === 'session_ended') {
    console.log('Session ended:', data.session_data);
  }
};

// Capture and send audio
function startMicrophone() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];
            ws.send(JSON.stringify({
              type: 'audio_data',
              audio: base64Audio
            }));
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Send audio every 100ms
      mediaRecorder.start(100);
    });
}
```

---

## 2. Keyterms Prompting

### 📝 Overview
Meningkatkan akurasi ASR untuk kata-kata khusus seperti nama, technical terms, brand names.

### Implementation

#### Untuk Transcription Biasa
Keyterms **otomatis** diambil dari:
- ✅ Nama partisipan meeting
- ✅ Kata-kata dari meeting title (> 3 karakter)
- ✅ Boost level: "high"

Sudah terintegrasi di `transcribeWithAssemblyAIEnhanced()`.

#### Untuk Streaming
Keyterms **otomatis** diambil dari:
- ✅ Nama partisipan meeting
- ✅ Kata-kata dari meeting title
- ✅ Keyterms custom yang dikirim client

```javascript
ws.send(JSON.stringify({
  type: 'start_session',
  meeting_id: 123,
  user_id: 1,
  keyterms: ["naraMEET", "AssemblyAI", "PostgreSQL"], // Custom keyterms
  ...
}));
```

### Limits & Best Practices

**Limits:**
- ✅ Maximum: 100 keyterms per session
- ✅ Maximum: 50 characters per keyterm

**Best Practices:**
- ✅ Gunakan untuk **proper names** (nama orang, perusahaan)
- ✅ Gunakan untuk **technical terms** (PostgreSQL, Docker, Kubernetes)
- ✅ Gunakan untuk **domain-specific vocabulary**
- ❌ JANGAN gunakan untuk common words ("meeting", "agenda")
- ✅ Gunakan capitalization yang benar ("AssemblyAI", bukan "assemblyai")

**Example:**
```javascript
const goodKeyterms = [
  "naraMEET",
  "AssemblyAI",
  "John Doe",
  "PostgreSQL",
  "Docker",
  "Project Phoenix"
];

const badKeyterms = [
  "meeting",     // Too common
  "information", // Generic word
  "the",         // Stop word
  "a",           // Too short
];
```

---

## 3. Speaker Identification

### 🎭 Overview
Mengubah label speaker generic ("Speaker A", "Speaker B") menjadi nama asli atau role.

### API Endpoints

#### POST `/api/transcripts/:transcript_id/identify-speakers`

Identifikasi speaker setelah transcription selesai.

**Request Body:**
```json
{
  "speaker_type": "name",
  "known_values": ["Michel Martin", "Peter DeCarlo"]
}
```

atau dengan roles:
```json
{
  "speaker_type": "role",
  "known_values": ["Interviewer", "Interviewee"]
}
```

**Response:**
```json
{
  "success": true,
  "transcript_id": "abc123",
  "speaker_type": "name",
  "utterances": [
    {
      "speaker": "Michel Martin",
      "text": "Good morning, and welcome to the show.",
      "start": 240,
      "end": 2560,
      "confidence": 0.98,
      "words": [...]
    },
    {
      "speaker": "Peter DeCarlo",
      "text": "Thanks for having me.",
      "start": 2800,
      "end": 3200,
      "confidence": 0.95,
      "words": [...]
    }
  ],
  "speaker_identification": {
    "request": {
      "speaker_identification": {
        "speaker_type": "name",
        "known_values": ["Michel Martin", "Peter DeCarlo"]
      }
    },
    "response": {
      "speaker_identification": {
        "status": "success"
      }
    }
  }
}
```

### Common Use Cases

#### 1. Customer Service Calls
```json
{
  "speaker_type": "role",
  "known_values": ["Agent", "Customer"]
}
```

#### 2. Interviews
```json
{
  "speaker_type": "role",
  "known_values": ["Interviewer", "Interviewee"]
}
```

#### 3. Podcasts
```json
{
  "speaker_type": "name",
  "known_values": ["Host Name", "Guest Name"]
}
```

#### 4. Business Meetings
```json
{
  "speaker_type": "name",
  "known_values": ["CEO", "CFO", "CTO", "Product Manager"]
}
```

### How It Works

1. AssemblyAI uses **content analysis** dari percakapan
2. Mencari **self-introductions** ("My name is...")
3. Mencari **mentions** dari speaker oleh speaker lain
4. Matching dengan `known_values` yang diberikan
5. Assign nama/role ke setiap utterance

### Important Notes

- ✅ Requires **Speaker Diarization** to be enabled first
- ✅ Works best dengan **clear speaker separation**
- ✅ `known_values` is **optional** untuk `speaker_type: "name"`
- ✅ `known_values` is **required** untuk `speaker_type: "role"`
- ✅ Maximum **35 characters** per value

---

## 4. Translation

### 🌍 Overview
Menerjemahkan transkrip ke 100+ bahasa dengan satu API call.

### API Endpoint

#### POST `/api/transcripts/:transcript_id/translate`

**Request Body:**
```json
{
  "target_languages": ["es", "de", "id"],
  "formal": true
}
```

**Response:**
```json
{
  "success": true,
  "transcript_id": "abc123",
  "original_text": "Smoke from hundreds of wildfires in Canada is triggering air quality alerts throughout the US...",
  "translated_texts": {
    "es": "El humo de cientos de incendios forestales en Canadá está provocando alertas de calidad del aire en todo Estados Unidos...",
    "de": "Rauch von Hunderten von Waldbränden in Kanada löst in den gesamten USA Luftqualitätswarnungen aus...",
    "id": "Asap dari ratusan kebakaran hutan di Kanada memicu peringatan kualitas udara di seluruh AS..."
  },
  "translation_info": {
    "request": {
      "translation": {
        "formal": true,
        "target_languages": ["es", "de", "id"]
      }
    },
    "response": {
      "translation": {
        "status": "success"
      }
    }
  }
}
```

### Supported Languages

**100+ languages supported**, including:
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `nl` - Dutch
- `hi` - Hindi
- `ja` - Japanese
- `zh` - Chinese
- `ko` - Korean
- `id` - Indonesian
- `ar` - Arabic
- `ru` - Russian
- `tr` - Turkish
- Dan masih banyak lagi...

Full list: [AssemblyAI Translation Docs](https://www.assemblyai.com/docs)

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target_languages` | array | Yes | Array of language codes |
| `formal` | boolean | No | Use formal language style (default: false) |

**Formal vs Informal:**
```javascript
// Informal (default)
"Hi, how are you?" → "Hola, ¿cómo estás?"

// Formal
"Hi, how are you?" → "Hola, ¿cómo está usted?"
```

### Use Cases

#### 1. Multilingual Subtitles
```javascript
await fetch(`/api/transcripts/${transcriptId}/translate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    target_languages: ['es', 'fr', 'de', 'ja', 'zh'],
    formal: false
  })
});
```

#### 2. Customer Support (Formal)
```javascript
await fetch(`/api/transcripts/${transcriptId}/translate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    target_languages: ['es', 'pt'],
    formal: true
  })
});
```

#### 3. Global Meeting Notes
```javascript
await fetch(`/api/transcripts/${transcriptId}/translate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    target_languages: ['id', 'en', 'zh', 'ja'],
    formal: true
  })
});
```

---

## 5. Complete Workflow API

### 🔄 Overview
All-in-one endpoint: **Transcribe + Identify Speakers + Translate** dalam satu request.

### API Endpoint

#### POST `/api/transcribe/complete`

**Form Data:**
```javascript
const formData = new FormData();
formData.append('audio', audioFile);
formData.append('meeting_id', '123');
formData.append('language', 'id');
formData.append('enable_diarization', 'true');

// Speaker Identification
formData.append('speaker_type', 'name');
formData.append('known_speakers', JSON.stringify([
  'John Doe',
  'Jane Smith'
]));

// Translation
formData.append('translate_to', JSON.stringify(['en', 'es', 'ja']));
formData.append('translation_formal', 'true');
```

**Response:**
```json
{
  "success": true,
  "message": "Complete workflow finished successfully",
  "transcript_id": "abc123xyz",
  "text": "Full transcript text...",
  "utterances": [
    {
      "speaker": "John Doe",
      "text": "Welcome to the meeting...",
      "start": 0,
      "end": 3500,
      "confidence": 0.98
    }
  ],
  "speaker_identification": {
    "request": {...},
    "response": {...}
  },
  "translated_texts": {
    "en": "Welcome to the meeting...",
    "es": "Bienvenido a la reunión...",
    "ja": "会議へようこそ..."
  },
  "auto_highlights": [...],
  "sentiment_analysis": [...],
  "entities": [...],
  "chapters": [...]
}
```

### JavaScript Example

```javascript
async function transcribeComplete(audioFile, meetingId) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('meeting_id', meetingId);
  formData.append('language', 'multi'); // Auto-detect
  formData.append('enable_diarization', 'true');

  // Speaker Identification
  formData.append('speaker_type', 'name');
  formData.append('known_speakers', JSON.stringify([
    'CEO',
    'CFO',
    'Product Manager'
  ]));

  // Translation
  formData.append('translate_to', JSON.stringify(['en', 'id', 'ja']));
  formData.append('translation_formal', 'true');

  const response = await fetch('/api/transcribe/complete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const result = await response.json();

  console.log('Transcript:', result.text);
  console.log('Speakers identified:', result.utterances.length);
  console.log('Translations:', Object.keys(result.translated_texts));
  console.log('Highlights:', result.auto_highlights.results.length);

  return result;
}
```

---

## 6. Best Practices

### Streaming API

1. **Audio Format:**
   - Sample rate: 16000 Hz (recommended)
   - Channels: Mono (1 channel)
   - Format: PCM16 atau Opus
   - Chunk size: 50-100ms

2. **Turn Detection:**
   - Voice agents: `"aggressive"`
   - Normal conversations: `"balanced"`
   - Formal meetings: `"conservative"`

3. **Keyterms:**
   - Maximum 100 keyterms
   - Include participant names
   - Include technical terms
   - Avoid common words

4. **Error Handling:**
   ```javascript
   ws.onerror = (error) => {
     console.error('WebSocket error:', error);
     // Reconnect logic
   };

   ws.onclose = (event) => {
     if (event.code === 1008) {
       alert('Unauthorized connection');
     } else if (event.code === 3005) {
       alert('Session expired');
     }
   };
   ```

### Speaker Identification

1. **Preparation:**
   - Enable Speaker Diarization first
   - Ensure good audio quality
   - Clear speaker separation

2. **Known Values:**
   - Use exact spelling
   - Max 35 characters per value
   - Include both first & last name

3. **When to use:**
   - ✅ Interviews (2-3 speakers)
   - ✅ Customer calls (2 speakers)
   - ✅ Small meetings (2-5 speakers)
   - ❌ Large conferences (>10 speakers)

### Translation

1. **Choose Languages Wisely:**
   - Don't translate to too many languages (max 5-10)
   - Consider your audience

2. **Formal vs Informal:**
   - Business: `formal: true`
   - Casual: `formal: false`
   - Customer support: `formal: true`

3. **Performance:**
   - Translation adds ~2-5 seconds per language
   - Consider async processing for many languages

---

## 📚 Additional Resources

- **AssemblyAI Docs:** https://www.assemblyai.com/docs
- **Streaming API:** https://www.assemblyai.com/docs/speech-to-text/streaming
- **Speaker Identification:** https://www.assemblyai.com/docs/speech-to-text/speaker-identification
- **Translation:** https://www.assemblyai.com/docs/speech-to-text/translation

---

**Made with ❤️ for naraMEET v2.1**

Last Updated: 2025-01-19
