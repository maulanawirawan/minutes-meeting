# 🚀 naraMEET API Reference - AssemblyAI Features

Quick reference for all AssemblyAI-powered endpoints.

---

## 🔐 Authentication

All endpoints require authentication via JWT token in header:

```
Authorization: Bearer <your_jwt_token>
```

---

## 📝 Transcription Endpoints

### 1. Basic Transcription

```http
POST /api/transcribe
Content-Type: application/json

{
  "meeting_id": 123,
  "language": "id",           // "id", "en", "multi", etc.
  "enable_diarization": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transcription completed",
  "data": {
    "transcript_id": "abc123...",
    "segments_count": 45
  }
}
```

### 2. Advanced Transcription (All Features)

```http
POST /api/meetings/:id/transcribe-advanced
Content-Type: application/json

{
  "language": "id",
  "enable_diarization": true,

  // Speaker configuration
  "speaker_config": {
    "exact_count": 3,          // OR use min/max below
    "min_speakers": 2,
    "max_speakers": 5
  },

  // Custom spelling
  "custom_spelling": [
    {
      "from": ["naraMEET", "nara meet"],
      "to": "naraMEET"
    },
    {
      "from": ["SQL", "sequel"],
      "to": "SQL"
    }
  ],

  // Other options
  "keep_filler_words": false,
  "multichannel": false,
  "start_ms": 0,               // Optional: segment start
  "end_ms": 300000             // Optional: segment end (5 min)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Advanced transcription completed",
  "data": {
    "transcript_id": "abc123...",
    "utterances_count": 45,
    "highlights_count": 8,
    "entities_count": 12,
    "chapters_count": 5
  }
}
```

### 3. Multichannel Transcription

```http
POST /api/meetings/:id/transcribe-multichannel
Content-Type: application/json

{
  "language": "id"
}
```

**Use Case:** Phone calls with separate left/right channels

**Response:**
```json
{
  "success": true,
  "message": "Multichannel transcription completed",
  "data": {
    "transcript_id": "abc123...",
    "audio_channels": 2,
    "utterances_count": 45
  }
}
```

### 4. Segment Transcription

```http
POST /api/meetings/:id/transcribe-segment
Content-Type: application/json

{
  "start_ms": 5000,      // Start at 5 seconds
  "end_ms": 60000,       // End at 60 seconds
  "language": "id"
}
```

**Use Case:** Transcribe specific portion of long audio

**Response:**
```json
{
  "success": true,
  "data": {
    "transcript_id": "abc123...",
    "text": "Full transcript text...",
    "duration_ms": 55000,
    "utterances": [...]
  }
}
```

---

## 📄 Export Endpoints

### 1. Export SRT Subtitles

```http
POST /api/export/srt
Content-Type: application/json

{
  "meeting_id": 123,
  "chars_per_caption": 32    // Optional, default 32
}
```

**Response:** SRT file download

```
1
00:00:00,250 --> 00:00:02,350
Smoke from hundreds of wildfires

2
00:00:02,730 --> 00:00:04,650
in Canada is triggering air quality
```

### 2. Export VTT Subtitles

```http
POST /api/export/vtt
Content-Type: application/json

{
  "meeting_id": 123,
  "chars_per_caption": 32
}
```

**Response:** VTT file download

```
WEBVTT

00:00:00.250 --> 00:00:02.350
Smoke from hundreds of wildfires

00:00:02.730 --> 00:00:04.650
in Canada is triggering air quality
```

### 3. Get Paragraphs

```http
GET /api/transcripts/:meeting_id/paragraphs
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paragraphs": [
      {
        "text": "Paragraph text here...",
        "start": 0,
        "end": 15000,
        "confidence": 0.95,
        "words": [...]
      }
    ]
  }
}
```

### 4. Get Sentences

```http
GET /api/transcripts/:meeting_id/sentences
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sentences": [
      {
        "text": "This is a sentence.",
        "start": 0,
        "end": 3000,
        "confidence": 0.95,
        "words": [...]
      }
    ]
  }
}
```

---

## 🤖 AI Intelligence Endpoints

### 1. Get Auto Highlights

```http
GET /api/meetings/:id/highlights
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "text": "We need to finalize the budget by Friday",
      "count": 3,
      "rank": 0.98,
      "timestamps": [
        {"start": 5000, "end": 7000},
        {"start": 45000, "end": 47000}
      ]
    }
  ]
}
```

### 2. Get Sentiment Analysis

```http
GET /api/meetings/:id/sentiment
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "total_segments": 38,
      "positive_count": 25,
      "negative_count": 5,
      "neutral_count": 8,
      "sentiment_score": 0.67
    },
    "transcripts": [
      {
        "speaker": "Speaker A",
        "text": "This is great progress!",
        "sentiment": "POSITIVE",
        "sentiment_score": 0.95,
        "start_time": 0,
        "end_time": 3000
      }
    ]
  }
}
```

### 3. Get Entity Detection

```http
GET /api/meetings/:id/entities
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "entity_type": "person_name",
      "text": "John Smith",
      "start_time": 5000,
      "end_time": 6000
    },
    {
      "id": 2,
      "entity_type": "location",
      "text": "Jakarta",
      "start_time": 12000,
      "end_time": 13000
    },
    {
      "id": 3,
      "entity_type": "date",
      "text": "March 15th",
      "start_time": 18000,
      "end_time": 19000
    }
  ]
}
```

**Entity Types:**
- `person_name` - People's names
- `location` - Cities, countries, addresses
- `organization` - Company names
- `date` - Dates
- `phone_number` - Phone numbers
- `email_address` - Email addresses
- `currency` - Monetary amounts
- `credit_card_number` - Credit card numbers
- `medical_condition` - Medical terms
- `medication` - Drug names

### 4. Get Auto Chapters

```http
GET /api/meetings/:id/chapters
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "headline": "Project Budget Discussion",
      "summary": "Team discussed the project budget allocation...",
      "gist": "Budget planning",
      "start_time": 0,
      "end_time": 120000,
      "sequence_number": 0
    },
    {
      "id": 2,
      "headline": "Timeline Review",
      "summary": "Reviewed project milestones and deadlines...",
      "gist": "Timeline planning",
      "start_time": 120000,
      "end_time": 240000,
      "sequence_number": 1
    }
  ]
}
```

---

## 🔍 Search & Analysis

### Word Search

```http
GET /api/transcripts/:meeting_id/word-search?words=budget,deadline,important
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "transcript_id",
    "total_count": 15,
    "matches": [
      {
        "text": "budget",
        "count": 8,
        "timestamps": [
          [5000, 6000],
          [45000, 46000],
          [78000, 79000]
        ],
        "indexes": [12, 156, 234]
      },
      {
        "text": "deadline",
        "count": 5,
        "timestamps": [[...]],
        "indexes": [...]
      }
    ]
  }
}
```

---

## 🌊 Streaming Endpoints

### Generate Temporary Token

```http
POST /api/streaming/token
Content-Type: application/json

{
  "expires_in": 3600    // 1-600 seconds, default 3600 (1 hour)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "temp_abc123xyz...",
    "expires_in": 3600,
    "expires_at": "2025-01-18T10:30:00.000Z"
  }
}
```

**Usage:** Use this token on client-side for WebSocket streaming

```javascript
const ws = new WebSocket(
  'wss://streaming.assemblyai.com/v3/ws?token=' + temporaryToken
);
```

---

## 🗑️ Transcript Management

### Delete Transcript

```http
DELETE /api/transcripts/:transcript_id
```

**Response:**
```json
{
  "success": true,
  "message": "Transcript deleted successfully"
}
```

**Note:** This removes the transcript from AssemblyAI servers and clears the ID from your database.

---

## 🎥 Recording Endpoints

### 1. Start Recording

```http
POST /api/meetings/:id/start-recording
```

**Response:**
```json
{
  "success": true,
  "message": "Recording started",
  "data": {
    "recording_id": 123,
    "meeting_id": 456,
    "started_at": "2025-01-18T10:00:00.000Z"
  }
}
```

### 2. Stop Recording

```http
POST /api/meetings/:id/stop-recording
Content-Type: application/json

{
  "auto_transcribe": true    // Optional, default true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recording stopped",
  "data": {
    "recording_id": 123,
    "meeting_id": 456,
    "ended_at": "2025-01-18T11:00:00.000Z",
    "auto_transcribe": true
  }
}
```

### 3. Upload Recording

```http
POST /api/meetings/:id/upload-recording
Content-Type: multipart/form-data

recording: <file>
auto_transcribe: true
```

**Response:**
```json
{
  "success": true,
  "message": "Recording uploaded successfully",
  "data": {
    "recording_id": 123,
    "file_size": 52428800,
    "format": "video/webm"
  }
}
```

---

## 📊 Complete Request Examples

### Example 1: Basic Meeting Transcription

```bash
curl -X POST https://localhost:8443/api/transcribe \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": 123,
    "language": "id",
    "enable_diarization": true
  }'
```

### Example 2: Advanced Transcription with Custom Spelling

```bash
curl -X POST https://localhost:8443/api/meetings/123/transcribe-advanced \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "id",
    "enable_diarization": true,
    "speaker_config": {
      "min_speakers": 2,
      "max_speakers": 5
    },
    "custom_spelling": [
      {
        "from": ["naraMEET"],
        "to": "naraMEET"
      }
    ],
    "keep_filler_words": false
  }'
```

### Example 3: Export SRT Subtitles

```bash
curl -X POST https://localhost:8443/api/export/srt \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": 123,
    "chars_per_caption": 32
  }' \
  --output meeting-123.srt
```

### Example 4: Word Search

```bash
curl -X GET "https://localhost:8443/api/transcripts/123/word-search?words=budget,deadline,important" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example 5: Get Highlights

```bash
curl -X GET https://localhost:8443/api/meetings/123/highlights \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example 6: Generate Streaming Token

```bash
curl -X POST https://localhost:8443/api/streaming/token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expires_in": 600
  }'
```

---

## ⚠️ Error Responses

All endpoints follow this error format:

```json
{
  "success": false,
  "error": "Error description here"
}
```

**Common Error Codes:**

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing JWT token |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server-side issue |

---

## 🔄 Rate Limits

- **Transcription:** 10 requests per 15 minutes per user
- **Exports:** 50 requests per minute
- **Search:** 100 requests per minute
- **Streaming Tokens:** 20 requests per hour

---

## 🎯 Best Practices

### 1. Always Use Retry Logic

```javascript
async function transcribeWithRetry(meetingId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meeting_id: meetingId,
          language: 'id',
          enable_diarization: true
        })
      });

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}
```

### 2. Cache Transcript IDs

Store `transcript_id` in your database for later access to exports and searches without re-transcribing.

### 3. Use Appropriate Speaker Config

- **Known speakers:** Use `exact_count`
- **Uncertain speakers:** Use `min_speakers` and `max_speakers`

### 4. Segment Long Audio

For audio > 30 minutes, consider using `audio_start_from` and `audio_end_at` to process in chunks.

---

## 📚 Related Documentation

- **Main Features:** See [ASSEMBLYAI-FEATURES.md](./ASSEMBLYAI-FEATURES.md)
- **Setup Guide:** See [SETUP.md](./SETUP.md)
- **Database Schema:** See [migration-v2-enhanced.sql](./migration-v2-enhanced.sql)

---

**Last Updated:** 2025-01-18
**Version:** 2.1
**API Base URL:** `https://localhost:8443/api`
