# 🎙️ AssemblyAI Complete Features Documentation

Complete implementation guide for all AssemblyAI features in naraMEET.

---

## 📚 Table of Contents

1. [Core Transcription Features](#core-transcription-features)
2. [Speaker Detection](#speaker-detection)
3. [Audio Intelligence](#audio-intelligence)
4. [Export & Formatting](#export--formatting)
5. [Advanced Features](#advanced-features)
6. [Streaming Speech-to-Text](#streaming-speech-to-text)
7. [API Reference](#api-reference)

---

## 🎯 Core Transcription Features

### 1. Basic Transcription

```javascript
// Simple transcription
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  language_code: 'id' // Indonesian
});
```

### 2. Multilingual Detection

Automatically detect language from audio:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  language_detection: true // Auto-detect language
});
```

**Supported Languages:**
- English (en, en_au, en_uk, en_us)
- Indonesian (id)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Dutch (nl)
- Hindi (hi)
- Japanese (ja)
- Korean (ko)
- Chinese (zh)
- And 90+ more languages!

### 3. Speech Model Selection

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  speech_model: 'universal' // or 'slam-1' for fastest processing
});
```

**Available Models:**
- `universal` - Best accuracy, supports all languages (default)
- `slam-1` - Fastest processing, English only

---

## 🎭 Speaker Detection

### 1. Speaker Diarization (Who Said What)

Automatically identify different speakers:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  speaker_labels: true,
  speakers_expected: 3 // Optional: exact number of speakers
});

// Access utterances with speaker labels
transcript.utterances.forEach(utterance => {
  console.log(`Speaker ${utterance.speaker}: ${utterance.text}`);
});
```

**API Endpoint:**
```
POST /api/transcribe
Body: {
  "meeting_id": 123,
  "language": "id",
  "enable_diarization": true
}
```

### 2. Speaker Range Configuration

Set minimum and maximum expected speakers:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  speaker_labels: true,
  speaker_options: {
    min_speakers_expected: 2,
    max_speakers_expected: 5
  }
});
```

**When to use:**
- `speakers_expected` - When you know exact number of speakers
- `speaker_options` - When you have a range (recommended for flexibility)

**API Endpoint:**
```
POST /api/meetings/:id/transcribe-advanced
Body: {
  "speaker_config": {
    "min_speakers": 2,
    "max_speakers": 5
  }
}
```

### 3. Multichannel Transcription

Transcribe multi-channel audio files (e.g., phone calls with separate channels):

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  multichannel: true
});

// Each utterance includes channel information
transcript.utterances.forEach(utterance => {
  console.log(`Channel ${utterance.channel}: ${utterance.text}`);
});
```

**API Endpoint:**
```
POST /api/meetings/:id/transcribe-multichannel
```

---

## 🤖 Audio Intelligence

### 1. Auto Highlights

Automatically detect and extract key moments:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  auto_highlights: true
});

// Access highlights
transcript.auto_highlights_result.results.forEach(highlight => {
  console.log(`Key Point: ${highlight.text}`);
  console.log(`Importance: ${highlight.rank}`);
  console.log(`Mentioned ${highlight.count} times`);
});
```

**Database Storage:**
- Table: `meeting_highlights`
- Fields: `text`, `count`, `rank`, `timestamps`

**API Endpoint:**
```
GET /api/meetings/:id/highlights
```

### 2. Sentiment Analysis

Detect emotions per utterance (POSITIVE, NEGATIVE, NEUTRAL):

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  sentiment_analysis: true
});

// Sentiment per segment
transcript.sentiment_analysis_results.forEach(sentiment => {
  console.log(`${sentiment.sentiment}: ${sentiment.text}`);
  console.log(`Confidence: ${sentiment.confidence}`);
});
```

**API Endpoint:**
```
GET /api/meetings/:id/sentiment
Response: {
  "statistics": {
    "positive_count": 15,
    "negative_count": 3,
    "neutral_count": 20,
    "sentiment_score": 0.67
  },
  "transcripts": [...]
}
```

### 3. Entity Detection

Extract names, dates, locations, organizations:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  entity_detection: true
});

// Detected entities
transcript.entities.forEach(entity => {
  console.log(`${entity.entity_type}: ${entity.text}`);
  // Types: person_name, location, organization, date, time, etc.
});
```

**API Endpoint:**
```
GET /api/meetings/:id/entities
```

### 4. Auto Chapters

Automatically segment meeting into chapters:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  auto_chapters: true
});

// Chapters with summaries
transcript.chapters.forEach(chapter => {
  console.log(`Chapter: ${chapter.headline}`);
  console.log(`Summary: ${chapter.summary}`);
  console.log(`Gist: ${chapter.gist}`);
  console.log(`Duration: ${chapter.start} - ${chapter.end}ms`);
});
```

**API Endpoint:**
```
GET /api/meetings/:id/chapters
```

---

## 📄 Export & Formatting

### 1. Export SRT Subtitles

Export transcript as SRT subtitle file:

```javascript
const srt = await assemblyClient.transcripts.subtitles(
  transcriptId,
  'srt',
  32 // chars_per_caption (optional)
);
```

**API Endpoint:**
```
POST /api/export/srt
Body: {
  "meeting_id": 123,
  "chars_per_caption": 32
}
```

**Output Example:**
```
1
00:00:00,250 --> 00:00:02,350
Smoke from hundreds of wildfires

2
00:00:02,730 --> 00:00:04,650
in Canada is triggering air quality alerts
```

### 2. Export VTT Subtitles

Export as WebVTT format:

```javascript
const vtt = await assemblyClient.transcripts.subtitles(
  transcriptId,
  'vtt',
  32
);
```

**API Endpoint:**
```
POST /api/export/vtt
Body: {
  "meeting_id": 123,
  "chars_per_caption": 32
}
```

### 3. Export Paragraphs

Get transcript organized into paragraphs:

```javascript
const { paragraphs } = await assemblyClient.transcripts.paragraphs(transcriptId);

paragraphs.forEach(paragraph => {
  console.log(paragraph.text);
  console.log(`Duration: ${paragraph.start} - ${paragraph.end}ms`);
});
```

**API Endpoint:**
```
GET /api/transcripts/:meeting_id/paragraphs
```

### 4. Export Sentences

Get transcript organized into sentences:

```javascript
const { sentences } = await assemblyClient.transcripts.sentences(transcriptId);

sentences.forEach(sentence => {
  console.log(sentence.text);
  console.log(`Speaker: ${sentence.speaker}`);
});
```

**API Endpoint:**
```
GET /api/transcripts/:meeting_id/sentences
```

### 5. Word-Level Timestamps

Access individual word timestamps:

```javascript
transcript.words.forEach(word => {
  console.log(`${word.text}: ${word.start}ms - ${word.end}ms`);
  console.log(`Confidence: ${word.confidence}`);
  console.log(`Speaker: ${word.speaker}`);
});
```

---

## 🔍 Advanced Features

### 1. Word Search

Search for specific words/phrases in transcript:

```javascript
const searchResults = await assemblyClient.transcripts.wordSearch(
  transcriptId,
  ['important', 'deadline', 'budget']
);

searchResults.matches.forEach(match => {
  console.log(`Found "${match.text}" ${match.count} times`);
  console.log(`Timestamps: ${match.timestamps}`);
});
```

**API Endpoint:**
```
GET /api/transcripts/:meeting_id/word-search?words=important,deadline,budget
```

### 2. Custom Spelling

Customize how specific words are spelled:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  custom_spelling: [
    {
      from: ['Decarlo', 'de carlo'],
      to: 'DeCarlo'
    },
    {
      from: ['Sequel'],
      to: 'SQL'
    },
    {
      from: ['naraMEET', 'nara meet'],
      to: 'naraMEET'
    }
  ]
});
```

**API Usage:**
```
POST /api/meetings/:id/transcribe-advanced
Body: {
  "custom_spelling": [
    {"from": ["naraMEET"], "to": "naraMEET"},
    {"from": ["AssemblyAI"], "to": "AssemblyAI"}
  ]
}
```

### 3. Filler Words Removal

Keep or remove filler words (um, uh, hmm):

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  disfluencies: true // Keep filler words (default: false)
});
```

**Removed by default:**
- "um", "uh", "hmm", "mhm", "uh-huh", "ah", "huh", "hm", "m"

**API Usage:**
```
POST /api/meetings/:id/transcribe-advanced
Body: {
  "keep_filler_words": true
}
```

### 4. Punctuation & Formatting

Control text formatting:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  punctuate: true,      // Add punctuation (default: true)
  format_text: true     // Format numbers, dates (default: true)
});
```

**Examples:**
- Numbers: "twenty three" → "23"
- Dates: "march fifth two thousand twenty four" → "March 5th, 2024"
- Currency: "fifty dollars" → "$50"

### 5. Word Boost (Keyterms)

Boost recognition of specific terms:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  word_boost: ['naraMEET', 'AssemblyAI', 'PostgreSQL', 'Docker'],
  boost_param: 'high' // 'low', 'default', 'high'
});
```

**Auto-implemented:** naraMEET automatically extracts participant names and meeting title words as keyterms!

### 6. Audio Segment Transcription

Transcribe only part of audio file:

```javascript
const transcript = await assemblyClient.transcripts.transcribe({
  audio: audioFilePath,
  audio_start_from: 5000,  // Start at 5 seconds
  audio_end_at: 60000      // End at 60 seconds
});
```

**API Usage:**
```
POST /api/meetings/:id/transcribe-segment
Body: {
  "start_ms": 5000,
  "end_ms": 60000
}
```

### 7. Delete Transcripts

Remove transcript data from AssemblyAI:

```javascript
const deleted = await assemblyClient.transcripts.delete(transcriptId);
```

**API Endpoint:**
```
DELETE /api/transcripts/:transcript_id
```

---

## 🌊 Streaming Speech-to-Text

Real-time transcription for live meetings.

### 1. Authentication with Temporary Token

Generate temporary token for client-side streaming:

```javascript
// Server-side
const token = await assemblyClient.realtime.createTemporaryToken({
  expires_in: 3600 // 1 hour
});

// Send token to client
res.json({ token });
```

**API Endpoint:**
```
POST /api/streaming/token
Response: {
  "token": "temp_token_xyz123..."
}
```

### 2. Streaming Configuration

```javascript
const rt = new assemblyai.RealtimeTranscriber({
  token: temporaryToken,
  sample_rate: 16000,

  // Turn detection (end-of-turn)
  end_utterance_silence_threshold: 1000, // ms

  // Language
  language_code: 'id', // or use multilingual

  // Formatting
  disable_partial_transcripts: false,
  punctuate: true
});
```

### 3. Turn Detection

Intelligent turn detection for conversations:

```javascript
const rt = new assemblyai.RealtimeTranscriber({
  token: temporaryToken,
  sample_rate: 16000,

  // Turn detection config
  format_turns: true,
  end_of_turn_confidence_threshold: 0.4,
  min_end_of_turn_silence_when_confident: 400,
  max_turn_silence: 1280
});

rt.on('turn', (turn) => {
  if (turn.turn_is_formatted) {
    console.log('Final:', turn.transcript);
  } else {
    console.log('Partial:', turn.transcript);
  }
});
```

**Preset Configurations:**

**Aggressive (Quick responses):**
```json
{
  "end_of_turn_confidence_threshold": 0.4,
  "min_end_of_turn_silence_when_confident": 160,
  "max_turn_silence": 400
}
```

**Balanced (Natural conversation):**
```json
{
  "end_of_turn_confidence_threshold": 0.4,
  "min_end_of_turn_silence_when_confident": 400,
  "max_turn_silence": 1280
}
```

**Conservative (Thoughtful speech):**
```json
{
  "end_of_turn_confidence_threshold": 0.7,
  "min_end_of_turn_silence_when_confident": 800,
  "max_turn_silence": 3600
}
```

### 4. Multilingual Streaming

Real-time transcription in multiple languages:

```javascript
const rt = new assemblyai.RealtimeTranscriber({
  token: temporaryToken,
  sample_rate: 48000,
  speech_model: 'universal-streaming-multilingual'
});

// Supports: English, Spanish, French, German, Italian, Portuguese
```

### 5. Multichannel Streaming

For multi-channel audio (e.g., phone calls):

```javascript
// Create separate sessions for each channel
const channel1 = new assemblyai.RealtimeTranscriber({
  token: token1,
  sample_rate: 16000
});

const channel2 = new assemblyai.RealtimeTranscriber({
  token: token2,
  sample_rate: 16000
});

// Stream each channel separately
```

---

## 📊 API Reference

### Transcription Endpoints

```
POST   /api/transcribe                          - Basic transcription
POST   /api/meetings/:id/transcribe-advanced    - Advanced options
POST   /api/meetings/:id/transcribe-multichannel - Multichannel audio
POST   /api/meetings/:id/transcribe-segment     - Segment transcription
```

### Export Endpoints

```
POST   /api/export/srt                          - Export SRT subtitles
POST   /api/export/vtt                          - Export VTT subtitles
GET    /api/transcripts/:id/paragraphs          - Get paragraphs
GET    /api/transcripts/:id/sentences           - Get sentences
```

### Intelligence Endpoints

```
GET    /api/meetings/:id/highlights             - Auto highlights
GET    /api/meetings/:id/sentiment              - Sentiment analysis
GET    /api/meetings/:id/entities               - Entity detection
GET    /api/meetings/:id/chapters               - Auto chapters
```

### Search & Analysis

```
GET    /api/transcripts/:id/word-search?words=... - Word search
```

### Streaming Endpoints

```
POST   /api/streaming/token                     - Generate temp token
WS     wss://streaming.assemblyai.com/v3/ws     - WebSocket endpoint
```

### Transcript Management

```
DELETE /api/transcripts/:id                     - Delete transcript
GET    /api/transcripts/:id                     - Get transcript details
```

---

## 🎯 Complete Example

Here's a complete example using all major features:

```javascript
// 1. Transcribe with all features
const transcript = await assemblyClient.transcripts.transcribe({
  // Audio source
  audio: './meeting-recording.mp3',

  // Language
  language_code: 'id',
  // language_detection: true, // Or auto-detect

  // Model
  speech_model: 'universal',

  // Speaker detection
  speaker_labels: true,
  speaker_options: {
    min_speakers_expected: 2,
    max_speakers_expected: 5
  },

  // AI Intelligence
  auto_highlights: true,
  sentiment_analysis: true,
  entity_detection: true,
  auto_chapters: true,

  // Text formatting
  punctuate: true,
  format_text: true,
  disfluencies: false, // Remove filler words

  // Custom vocabulary
  word_boost: ['naraMEET', 'AssemblyAI'],
  boost_param: 'high',
  custom_spelling: [
    { from: ['nara meet'], to: 'naraMEET' }
  ],

  // Audio segment (optional)
  // audio_start_from: 0,
  // audio_end_at: 300000, // 5 minutes

  // Multichannel (if needed)
  // multichannel: true
});

// 2. Access results
console.log('Transcript:', transcript.text);

// 3. Speaker utterances
transcript.utterances.forEach(u => {
  console.log(`${u.speaker}: ${u.text}`);
});

// 4. Highlights
transcript.auto_highlights_result.results.forEach(h => {
  console.log(`⭐ ${h.text} (rank: ${h.rank})`);
});

// 5. Sentiment
transcript.sentiment_analysis_results.forEach(s => {
  console.log(`${s.sentiment}: ${s.text}`);
});

// 6. Entities
transcript.entities.forEach(e => {
  console.log(`${e.entity_type}: ${e.text}`);
});

// 7. Chapters
transcript.chapters.forEach(c => {
  console.log(`📖 ${c.headline}: ${c.summary}`);
});

// 8. Export SRT
const srt = await assemblyClient.transcripts.subtitles(
  transcript.id,
  'srt'
);

// 9. Word search
const search = await assemblyClient.transcripts.wordSearch(
  transcript.id,
  ['important', 'decision']
);

// 10. Get paragraphs
const { paragraphs } = await assemblyClient.transcripts.paragraphs(
  transcript.id
);
```

---

## 🚀 Best Practices

### 1. Retry Logic

Always implement retry logic for transcription:

```javascript
async function transcribeWithRetry(filePath, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transcript = await assemblyClient.transcripts.transcribe({
        audio: filePath
      });
      return transcript;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve =>
          setTimeout(resolve, attempt * 2000)
        );
      }
    }
  }

  throw lastError;
}
```

### 2. Store Transcript IDs

Always store `transcript.id` for later access:

```sql
UPDATE audio_files
SET assembly_transcript_id = $1
WHERE id = $2
```

### 3. Error Handling

Handle different error scenarios:

```javascript
try {
  const transcript = await assemblyClient.transcripts.transcribe(options);

  if (transcript.status === 'error') {
    throw new Error(`Transcription failed: ${transcript.error}`);
  }

} catch (error) {
  if (error.response?.status === 401) {
    console.error('Invalid API key');
  } else if (error.response?.status === 429) {
    console.error('Rate limit exceeded');
  } else {
    console.error('Transcription error:', error.message);
  }
}
```

### 4. Optimize for Your Use Case

Choose the right configuration:

**Phone Calls:**
```javascript
{
  multichannel: true,
  speaker_labels: true,
  speakers_expected: 2
}
```

**Meetings:**
```javascript
{
  speaker_labels: true,
  speaker_options: { min: 2, max: 10 },
  auto_chapters: true,
  auto_highlights: true
}
```

**Podcasts:**
```javascript
{
  speaker_labels: true,
  auto_chapters: true,
  disfluencies: true // Keep natural speech
}
```

**Interviews:**
```javascript
{
  speaker_labels: true,
  speakers_expected: 2,
  sentiment_analysis: true,
  entity_detection: true
}
```

---

## 📈 Performance Tips

1. **Use fastest model when accuracy is less critical:**
   ```javascript
   speech_model: 'slam-1' // Fastest, English only
   ```

2. **Disable features you don't need:**
   ```javascript
   auto_highlights: false,
   entity_detection: false,
   auto_chapters: false
   ```

3. **Use audio segments for long files:**
   ```javascript
   audio_start_from: 0,
   audio_end_at: 300000 // Process 5 minutes at a time
   ```

4. **Implement caching:**
   - Cache transcript results in database
   - Reuse transcript ID for exports/searches
   - Don't re-transcribe the same audio

---

## 🔒 Security Best Practices

1. **Protect API Keys:**
   ```javascript
   // Use environment variables
   const apiKey = process.env.ASSEMBLYAI_API_KEY;
   ```

2. **Use Temporary Tokens for Streaming:**
   ```javascript
   // Generate short-lived tokens for clients
   const token = await client.realtime.createTemporaryToken({
     expires_in: 3600 // 1 hour
   });
   ```

3. **Validate File Uploads:**
   ```javascript
   // Check file size, type, duration
   if (fileSize > 500 * 1024 * 1024) {
     throw new Error('File too large');
   }
   ```

4. **Implement Rate Limiting:**
   ```javascript
   // Limit transcription requests per user
   const rateLimit = require('express-rate-limit');

   app.use('/api/transcribe', rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 10 // Max 10 requests per window
   }));
   ```

---

## 📚 Additional Resources

- **AssemblyAI Docs:** https://www.assemblyai.com/docs
- **API Reference:** https://www.assemblyai.com/docs/api-reference
- **SDKs:** https://github.com/AssemblyAI
- **Support:** support@assemblyai.com

---

**Made with ❤️ for naraMEET**

Last Updated: 2025-01-18
