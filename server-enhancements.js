// ================================================================
// naraMEET v2.1 - AssemblyAI ENHANCED FEATURES
// ================================================================
// FILE: server-enhancements.js
// Purpose: Additional endpoints and functions for AssemblyAI features
// Features: Auto Highlights, Sentiment, Entities, Chapters, SRT/VTT, Word Search
//
// USAGE: Tambahkan ke server.js dengan:
// const enhancements = require('./server-enhancements');
// enhancements.setupEnhancements(app, assemblyClient, authMiddleware, query, queryOne);
// ================================================================

const fs = require('fs');
const path = require('path');

/**
 * ✅ ENHANCED: Transcribe dengan fitur lengkap AssemblyAI
 * Tambahkan ini sebagai replacement atau update fungsi transcribeWithAssemblyAI
 */
async function transcribeWithAssemblyAIEnhanced(filePath, language = 'id', enableDiarization = true, meetingId = null, assemblyClient, queryOne, query) {
    try {
        console.log('🚀 Starting AssemblyAI ENHANCED transcription...');
        console.log(`📍 File: ${filePath}`);
        console.log(`🌍 Language: ${language === 'multi' ? 'Multilingual' : language}`);
        console.log(`🎭 Speaker Diarization: ${enableDiarization ? 'Enabled' : 'Disabled'}`);

        // ✅ GENERATE KEYTERMS dari participants
        let keyterms = [];
        if (meetingId) {
            const participants = await query(
                'SELECT name FROM participants WHERE meeting_id = $1 AND deleted_at IS NULL',
                [meetingId]
            );

            keyterms = participants.rows.map(p => p.name);

            const meeting = await queryOne(
                'SELECT title, description FROM meetings WHERE id = $1',
                [meetingId]
            );

            if (meeting && meeting.title) {
                const titleWords = meeting.title.split(' ').filter(w => w.length > 3);
                keyterms = [...keyterms, ...titleWords];
            }

            console.log(`📝 Keyterms for boost: ${keyterms.join(', ')}`);
        }

        // ✅ ENHANCED TRANSCRIPTION OPTIONS
        const transcriptionOptions = {
            audio: filePath,
            speaker_labels: enableDiarization,
            language_code: language === 'multi' ? undefined : language,
            language_detection: language === 'multi',

            // Model
            speech_model: "universal",

            // Keyterms boost
            ...(keyterms.length > 0 && {
                word_boost: keyterms,
                boost_param: "high"
            }),

            // ✅ NEW: Auto Intelligence Features
            auto_highlights: true,              // Detect important points
            sentiment_analysis: true,           // Sentiment per utterance
            entity_detection: true,             // Detect names, dates, locations, etc
            auto_chapters: true,                // Auto divide into chapters

            // Text formatting
            format_text: true,                  // Format numbers, dates, currency
            punctuate: true,                    // Add punctuation

            // Optional: PII Redaction (uncomment if needed)
            // redact_pii: true,
            // redact_pii_policies: ['email_address', 'phone_number', 'credit_card_number'],
        };

        console.log('📤 Enhanced transcription options:', JSON.stringify(transcriptionOptions, null, 2));

        // Upload and transcribe with retry logic
        let transcript;
        let retries = 3;
        let lastError;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`🔄 Transcription attempt ${attempt}/${retries}...`);
                transcript = await assemblyClient.transcripts.transcribe(transcriptionOptions);
                console.log('✅ AssemblyAI transcription completed');
                break; // Success, exit retry loop
            } catch (error) {
                lastError = error;
                console.error(`❌ Attempt ${attempt} failed:`, error.message);

                if (attempt < retries) {
                    const waitTime = attempt * 2000; // 2s, 4s
                    console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        if (!transcript) {
            throw lastError || new Error('Transcription failed after retries');
        }

        console.log('✅ AssemblyAI transcription completed');
        console.log(`📊 Status: ${transcript.status}`);
        console.log(`📝 Text length: ${transcript.text?.length || 0} characters`);
        console.log(`🔖 Transcript ID: ${transcript.id}`);

        // 🔍 DEBUG: Check what AI features were returned
        console.log('🔍 AI Features Check:');
        console.log(`   - Highlights: ${transcript.auto_highlights_result ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   - Sentiment: ${transcript.sentiment_analysis_results ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   - Entities: ${transcript.entities ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   - Chapters: ${transcript.chapters ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   - Utterances: ${transcript.utterances?.length || 0} utterances`);

        if (transcript.status === 'error') {
            throw new Error(`Transcription failed: ${transcript.error}`);
        }

        // ✅ STORE TRANSCRIPT ID for later use (SRT/VTT/Word Search)
        if (meetingId && transcript.id) {
            await query(
                `UPDATE audio_files SET assembly_transcript_id = $1
                 WHERE id = (
                     SELECT id FROM audio_files
                     WHERE meeting_id = $2
                     ORDER BY uploaded_at DESC
                     LIMIT 1
                 )`,
                [transcript.id, meetingId]
            );
            console.log(`💾 Stored AssemblyAI Transcript ID: ${transcript.id}`);
        }

        // 🗑️ CLEAR OLD DATA - Delete previous highlights, entities, chapters for this meeting
        if (meetingId) {
            console.log('🗑️ Clearing old AI data for meeting...');
            await query('DELETE FROM meeting_highlights WHERE meeting_id = $1', [meetingId]);
            await query('DELETE FROM meeting_entities WHERE meeting_id = $1', [meetingId]);
            await query('DELETE FROM meeting_chapters WHERE meeting_id = $1', [meetingId]);
            console.log('✅ Old data cleared');
        }

        // ✅ SAVE HIGHLIGHTS to database
        if (transcript.auto_highlights_result && transcript.auto_highlights_result.results && transcript.auto_highlights_result.results.length > 0) {
            console.log(`✨ Auto highlights detected: ${transcript.auto_highlights_result.results.length} highlights`);

            for (const highlight of transcript.auto_highlights_result.results) {
                await query(
                    `INSERT INTO meeting_highlights (meeting_id, text, count, rank, timestamps)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        meetingId,
                        highlight.text,
                        highlight.count,
                        highlight.rank,
                        JSON.stringify(highlight.timestamps || [])
                    ]
                );
            }
        } else {
            console.log(`⚠️ No highlights returned by AssemblyAI (audio may be too short or lack significant content)`);
        }

        // ✅ SAVE ENTITIES to database
        if (transcript.entities && transcript.entities.length > 0) {
            console.log(`🏷️ Entities detected: ${transcript.entities.length} entities`);

            for (const entity of transcript.entities) {
                await query(
                    `INSERT INTO meeting_entities (meeting_id, entity_type, text, start_time, end_time)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        meetingId,
                        entity.entity_type,
                        entity.text,
                        entity.start,
                        entity.end
                    ]
                );
            }
        } else {
            console.log(`⚠️ No entities returned by AssemblyAI`);
        }

        // ✅ SAVE CHAPTERS to database
        if (transcript.chapters && transcript.chapters.length > 0) {
            console.log(`📖 Chapters detected: ${transcript.chapters.length} chapters`);

            let chapterIndex = 0;
            for (const chapter of transcript.chapters) {
                await query(
                    `INSERT INTO meeting_chapters (meeting_id, headline, summary, gist, start_time, end_time, sequence_number)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        meetingId,
                        chapter.headline,
                        chapter.summary,
                        chapter.gist,
                        chapter.start,
                        chapter.end,
                        chapterIndex++
                    ]
                );
            }
        } else {
            console.log(`⚠️ No chapters returned by AssemblyAI (audio may be too short)`);
        }

        // ✅ PROCESS UTTERANCES with SENTIMENT
        const segments = [];

        if (transcript.utterances && transcript.utterances.length > 0) {
            console.log(`🎤 Found ${transcript.utterances.length} utterances with speaker labels`);

            // Get sentiment analysis results
            const sentiments = transcript.sentiment_analysis_results || [];

            for (let i = 0; i < transcript.utterances.length; i++) {
                const utterance = transcript.utterances[i];

                // Find matching sentiment for this utterance
                const sentiment = sentiments.find(s =>
                    s.start >= utterance.start && s.end <= utterance.end
                ) || { sentiment: 'NEUTRAL', confidence: 0.5 };

                segments.push({
                    text: utterance.text.trim(),
                    start: utterance.start,
                    end: utterance.end,
                    speaker: `Speaker ${utterance.speaker}`,
                    confidence: utterance.confidence || 0.95,
                    sequence: i,
                    sentiment: sentiment.sentiment,
                    sentiment_score: sentiment.confidence
                });
            }

            return {
                segments,
                transcriptId: transcript.id,
                highlights: transcript.auto_highlights_result?.results || [],
                entities: transcript.entities || [],
                chapters: transcript.chapters || [],
                sentiments: sentiments
            };
        }

        // Fallback to words if no utterances
        if (transcript.words && transcript.words.length > 0) {
            console.log(`📝 Using word-level timestamps (${transcript.words.length} words)`);

            const sentences = [];
            let currentSentence = [];
            let sentenceStart = 0;

            transcript.words.forEach((word, index) => {
                if (currentSentence.length === 0) {
                    sentenceStart = word.start;
                }

                currentSentence.push(word.text);

                const endsWithPunctuation = /[.!?]$/.test(word.text);
                const isLongEnough = currentSentence.length >= 15;

                if (endsWithPunctuation || isLongEnough || index === transcript.words.length - 1) {
                    sentences.push({
                        text: currentSentence.join(' '),
                        start: sentenceStart,
                        end: word.end,
                        speaker: 'Speaker A',
                        confidence: 0.90,
                        sequence: sentences.length,
                        sentiment: 'NEUTRAL',
                        sentiment_score: 0.5
                    });
                    currentSentence = [];
                }
            });

            return {
                segments: sentences,
                transcriptId: transcript.id,
                highlights: transcript.auto_highlights_result?.results || [],
                entities: transcript.entities || [],
                chapters: transcript.chapters || []
            };
        }

        // Final fallback
        if (transcript.text && transcript.text.trim()) {
            console.log('ℹ️ Using full text as single segment');
            return {
                segments: [{
                    text: transcript.text.trim(),
                    start: 0,
                    end: 30000,
                    speaker: 'Speaker A',
                    confidence: 0.95,
                    sequence: 0,
                    sentiment: 'NEUTRAL',
                    sentiment_score: 0.5
                }],
                transcriptId: transcript.id,
                highlights: [],
                entities: [],
                chapters: []
            };
        }

        console.warn('⚠️ No transcription data found');
        return {
            segments: [],
            transcriptId: transcript.id,
            highlights: [],
            entities: [],
            chapters: []
        };

    } catch (error) {
        console.error('❌ AssemblyAI transcription error:', error);
        throw new Error(`AssemblyAI transcription failed: ${error.message}`);
    }
}

/**
 * Setup all enhancement endpoints
 */
function setupEnhancements(app, assemblyClient, authMiddleware, query, queryOne) {
    console.log('🚀 Setting up AssemblyAI Enhanced Features...');

    // ================================================================
    // ✅ ENDPOINT: Export SRT Subtitles
    // ================================================================
    app.post('/api/export/srt', authMiddleware, async (req, res) => {
        try {
            const { meeting_id, chars_per_caption = 32 } = req.body;

            if (!meeting_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Meeting ID required'
                });
            }

            // Get audio file with AssemblyAI transcript ID
            const audioFile = await queryOne(
                `SELECT assembly_transcript_id FROM audio_files
                 WHERE meeting_id = $1 AND processed = true AND assembly_transcript_id IS NOT NULL
                 ORDER BY uploaded_at DESC LIMIT 1`,
                [meeting_id]
            );

            if (!audioFile || !audioFile.assembly_transcript_id) {
                return res.status(400).json({
                    success: false,
                    error: 'No transcription found. Please transcribe audio first.'
                });
            }

            // Get SRT from AssemblyAI
            const srtContent = await assemblyClient.transcripts.subtitles(
                audioFile.assembly_transcript_id,
                'srt',
                chars_per_caption
            );

            // Track export
            await query(
                `INSERT INTO exports (meeting_id, user_id, export_type, file_size)
                 VALUES ($1, $2, 'srt', $3)`,
                [meeting_id, req.userId, Buffer.byteLength(srtContent)]
            );

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="meeting-${meeting_id}.srt"`);
            res.send(srtContent);

        } catch (error) {
            console.error('❌ SRT export error:', error);
            res.status(500).json({
                success: false,
                error: 'SRT export failed: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Export VTT Subtitles
    // ================================================================
    app.post('/api/export/vtt', authMiddleware, async (req, res) => {
        try {
            const { meeting_id, chars_per_caption = 32 } = req.body;

            if (!meeting_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Meeting ID required'
                });
            }

            const audioFile = await queryOne(
                `SELECT assembly_transcript_id FROM audio_files
                 WHERE meeting_id = $1 AND processed = true AND assembly_transcript_id IS NOT NULL
                 ORDER BY uploaded_at DESC LIMIT 1`,
                [meeting_id]
            );

            if (!audioFile || !audioFile.assembly_transcript_id) {
                return res.status(400).json({
                    success: false,
                    error: 'No transcription found. Please transcribe audio first.'
                });
            }

            // Get VTT from AssemblyAI
            const vttContent = await assemblyClient.transcripts.subtitles(
                audioFile.assembly_transcript_id,
                'vtt',
                chars_per_caption
            );

            // Track export
            await query(
                `INSERT INTO exports (meeting_id, user_id, export_type, file_size)
                 VALUES ($1, $2, 'vtt', $3)`,
                [meeting_id, req.userId, Buffer.byteLength(vttContent)]
            );

            res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="meeting-${meeting_id}.vtt"`);
            res.send(vttContent);

        } catch (error) {
            console.error('❌ VTT export error:', error);
            res.status(500).json({
                success: false,
                error: 'VTT export failed: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Word Search
    // ================================================================
    app.get('/api/transcripts/:meeting_id/word-search', authMiddleware, async (req, res) => {
        try {
            const { meeting_id } = req.params;
            const { words } = req.query;

            if (!words) {
                return res.status(400).json({
                    success: false,
                    error: 'Search words required (query param: words)'
                });
            }

            const audioFile = await queryOne(
                `SELECT assembly_transcript_id FROM audio_files
                 WHERE meeting_id = $1 AND processed = true AND assembly_transcript_id IS NOT NULL
                 ORDER BY uploaded_at DESC LIMIT 1`,
                [meeting_id]
            );

            if (!audioFile || !audioFile.assembly_transcript_id) {
                return res.status(400).json({
                    success: false,
                    error: 'No transcription found'
                });
            }

            // Split words by comma
            const wordArray = words.split(',').map(w => w.trim());

            // Search using AssemblyAI
            const searchResult = await assemblyClient.transcripts.wordSearch(
                audioFile.assembly_transcript_id,
                wordArray
            );

            res.json({
                success: true,
                data: searchResult
            });

        } catch (error) {
            console.error('❌ Word search error:', error);
            res.status(500).json({
                success: false,
                error: 'Word search failed: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Get Paragraphs
    // ================================================================
    app.get('/api/transcripts/:meeting_id/paragraphs', authMiddleware, async (req, res) => {
        try {
            const { meeting_id } = req.params;

            const audioFile = await queryOne(
                `SELECT assembly_transcript_id FROM audio_files
                 WHERE meeting_id = $1 AND processed = true AND assembly_transcript_id IS NOT NULL
                 ORDER BY uploaded_at DESC LIMIT 1`,
                [meeting_id]
            );

            if (!audioFile || !audioFile.assembly_transcript_id) {
                return res.status(400).json({
                    success: false,
                    error: 'No transcription found'
                });
            }

            const paragraphs = await assemblyClient.transcripts.paragraphs(
                audioFile.assembly_transcript_id
            );

            res.json({
                success: true,
                data: paragraphs
            });

        } catch (error) {
            console.error('❌ Paragraphs error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get paragraphs: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Get Sentences
    // ================================================================
    app.get('/api/transcripts/:meeting_id/sentences', authMiddleware, async (req, res) => {
        try {
            const { meeting_id } = req.params;

            const audioFile = await queryOne(
                `SELECT assembly_transcript_id FROM audio_files
                 WHERE meeting_id = $1 AND processed = true AND assembly_transcript_id IS NOT NULL
                 ORDER BY uploaded_at DESC LIMIT 1`,
                [meeting_id]
            );

            if (!audioFile || !audioFile.assembly_transcript_id) {
                return res.status(400).json({
                    success: false,
                    error: 'No transcription found'
                });
            }

            const sentences = await assemblyClient.transcripts.sentences(
                audioFile.assembly_transcript_id
            );

            res.json({
                success: true,
                data: sentences
            });

        } catch (error) {
            console.error('❌ Sentences error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get sentences: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Get Highlights
    // ================================================================
    app.get('/api/meetings/:id/highlights', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;

            const highlights = await query(
                `SELECT * FROM meeting_highlights
                 WHERE meeting_id = $1 AND deleted_at IS NULL
                 ORDER BY rank DESC, count DESC`,
                [id]
            );

            res.json({
                success: true,
                data: highlights.rows
            });

        } catch (error) {
            console.error('❌ Get highlights error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Get Entities
    // ================================================================
    app.get('/api/meetings/:id/entities', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;

            const entities = await query(
                `SELECT * FROM meeting_entities
                 WHERE meeting_id = $1 AND deleted_at IS NULL
                 ORDER BY entity_type, text`,
                [id]
            );

            res.json({
                success: true,
                data: entities.rows
            });

        } catch (error) {
            console.error('❌ Get entities error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Get Chapters
    // ================================================================
    app.get('/api/meetings/:id/chapters', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;

            const chapters = await query(
                `SELECT * FROM meeting_chapters
                 WHERE meeting_id = $1 AND deleted_at IS NULL
                 ORDER BY sequence_number`,
                [id]
            );

            res.json({
                success: true,
                data: chapters.rows
            });

        } catch (error) {
            console.error('❌ Get chapters error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Get Sentiment Overview
    // ================================================================
    app.get('/api/meetings/:id/sentiment', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;

            const sentimentStats = await query(
                `SELECT
                    COUNT(*) as total_segments,
                    SUM(CASE WHEN sentiment = 'POSITIVE' THEN 1 ELSE 0 END) as positive_count,
                    SUM(CASE WHEN sentiment = 'NEGATIVE' THEN 1 ELSE 0 END) as negative_count,
                    SUM(CASE WHEN sentiment = 'NEUTRAL' THEN 1 ELSE 0 END) as neutral_count,
                    ROUND(AVG(CASE
                        WHEN sentiment = 'POSITIVE' THEN 1.0
                        WHEN sentiment = 'NEGATIVE' THEN -1.0
                        ELSE 0.0
                    END)::numeric, 2) as sentiment_score
                 FROM transcripts
                 WHERE meeting_id = $1 AND deleted_at IS NULL`,
                [id]
            );

            const transcripts = await query(
                `SELECT speaker, text, sentiment, sentiment_score, start_time, end_time
                 FROM transcripts
                 WHERE meeting_id = $1 AND deleted_at IS NULL
                 ORDER BY sequence_number`,
                [id]
            );

            res.json({
                success: true,
                data: {
                    statistics: sentimentStats.rows[0],
                    transcripts: transcripts.rows
                }
            });

        } catch (error) {
            console.error('❌ Get sentiment error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Start Recording (Jitsi Integration)
    // ================================================================
    app.post('/api/meetings/:id/start-recording', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;

            // Check if meeting exists
            const meeting = await queryOne(
                'SELECT * FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
                [id, req.userId]
            );

            if (!meeting) {
                return res.status(404).json({
                    success: false,
                    error: 'Meeting not found'
                });
            }

            // Update meeting status
            await query(
                'UPDATE meetings SET is_recording = true, recording_started_at = NOW() WHERE id = $1',
                [id]
            );

            // Create recording entry
            const recordingPath = `./uploads/recordings/meeting-${id}-${Date.now()}.webm`;

            const recording = await queryOne(
                `INSERT INTO meeting_recordings (meeting_id, file_path, status, recording_type)
                 VALUES ($1, $2, 'recording', 'video')
                 RETURNING id`,
                [id, recordingPath]
            );

            res.json({
                success: true,
                message: 'Recording started',
                data: {
                    recording_id: recording.id,
                    meeting_id: id,
                    started_at: new Date()
                }
            });

        } catch (error) {
            console.error('❌ Start recording error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Stop Recording & Auto-Transcribe
    // ================================================================
    app.post('/api/meetings/:id/stop-recording', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const { auto_transcribe = true } = req.body;

            // Update meeting status
            await query(
                'UPDATE meetings SET is_recording = false, recording_ended_at = NOW() WHERE id = $1',
                [id]
            );

            // Update recording status
            const recording = await queryOne(
                `UPDATE meeting_recordings
                 SET status = 'completed', ended_at = NOW()
                 WHERE meeting_id = $1 AND status = 'recording'
                 RETURNING *`,
                [id]
            );

            if (!recording) {
                return res.status(404).json({
                    success: false,
                    error: 'No active recording found'
                });
            }

            res.json({
                success: true,
                message: 'Recording stopped',
                data: {
                    recording_id: recording.id,
                    meeting_id: id,
                    ended_at: recording.ended_at,
                    auto_transcribe: auto_transcribe
                }
            });

            // TODO: Implement auto-transcribe logic if file exists
            // This would extract audio from video and send to AssemblyAI

        } catch (error) {
            console.error('❌ Stop recording error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ================================================================
    // ✅ ENDPOINT: Upload Recording (from Jitsi/client)
    // ================================================================
    const multer = require('multer');
    const uploadRecording = multer({
        dest: './uploads/recordings/',
        limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
    });

    app.post('/api/meetings/:id/upload-recording', authMiddleware, uploadRecording.single('recording'), async (req, res) => {
        try {
            const { id } = req.params;
            const { auto_transcribe = 'true' } = req.body;

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No recording file provided'
                });
            }

            // Save recording to database
            const recording = await queryOne(
                `INSERT INTO meeting_recordings
                 (meeting_id, file_path, file_size, format, mime_type, status, ended_at)
                 VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
                 RETURNING id`,
                [
                    id,
                    req.file.path,
                    req.file.size,
                    path.extname(req.file.originalname).slice(1),
                    req.file.mimetype
                ]
            );

            res.json({
                success: true,
                message: 'Recording uploaded successfully',
                data: {
                    recording_id: recording.id,
                    file_size: req.file.size,
                    format: req.file.mimetype
                }
            });

            // TODO: Auto-transcribe if enabled
            // Extract audio using FFmpeg and send to transcription

        } catch (error) {
            console.error('❌ Upload recording error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ================================================================
    // ✅ NEW: Advanced Transcription with All Options
    // ================================================================
    app.post('/api/meetings/:id/transcribe-advanced', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const {
                language = 'id',
                enable_diarization = true,
                speaker_config = {},
                custom_spelling = [],
                keep_filler_words = false,
                multichannel = false,
                start_ms = null,
                end_ms = null
            } = req.body;

            // Get meeting and audio file
            const meeting = await queryOne(
                'SELECT * FROM meetings WHERE id = $1 AND deleted_at IS NULL',
                [id]
            );

            if (!meeting) {
                return res.status(404).json({
                    success: false,
                    error: 'Meeting not found'
                });
            }

            const audioFile = await queryOne(
                `SELECT * FROM audio_files
                 WHERE meeting_id = $1 AND deleted_at IS NULL
                 ORDER BY uploaded_at DESC LIMIT 1`,
                [id]
            );

            if (!audioFile || !audioFile.file_path) {
                return res.status(400).json({
                    success: false,
                    error: 'No audio file found for this meeting'
                });
            }

            // Build transcription options
            const transcriptionOptions = {
                audio: audioFile.file_path,
                language_code: language === 'multi' ? undefined : language,
                language_detection: language === 'multi',
                speech_model: 'universal',

                // Speaker configuration
                speaker_labels: enable_diarization,
                ...(speaker_config.exact_count && {
                    speakers_expected: speaker_config.exact_count
                }),
                ...(speaker_config.min_speakers && speaker_config.max_speakers && {
                    speaker_options: {
                        min_speakers_expected: speaker_config.min_speakers,
                        max_speakers_expected: speaker_config.max_speakers
                    }
                }),

                // Multichannel
                multichannel: multichannel,

                // Custom spelling
                ...(custom_spelling.length > 0 && {
                    custom_spelling: custom_spelling
                }),

                // Filler words
                disfluencies: keep_filler_words,

                // Audio segment
                ...(start_ms && { audio_start_from: start_ms }),
                ...(end_ms && { audio_end_at: end_ms }),

                // AI Features
                auto_highlights: true,
                sentiment_analysis: true,
                entity_detection: true,
                auto_chapters: true,

                // Formatting
                punctuate: true,
                format_text: true
            };

            console.log('🚀 Starting advanced transcription with options:', JSON.stringify(transcriptionOptions, null, 2));

            // Transcribe with retry logic
            let transcript;
            let retries = 3;
            let lastError;

            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    console.log(`🔄 Attempt ${attempt}/${retries}...`);
                    transcript = await assemblyClient.transcripts.transcribe(transcriptionOptions);
                    console.log('✅ Transcription completed');
                    break;
                } catch (error) {
                    lastError = error;
                    console.error(`❌ Attempt ${attempt} failed:`, error.message);

                    if (attempt < retries) {
                        const waitTime = attempt * 2000;
                        console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }
            }

            if (!transcript || transcript.status === 'error') {
                throw lastError || new Error('Transcription failed: ' + transcript?.error);
            }

            // Store transcript ID
            await query(
                `UPDATE audio_files SET assembly_transcript_id = $1
                 WHERE id = $2`,
                [transcript.id, audioFile.id]
            );

            // Save segments, highlights, entities, chapters (using existing logic)
            // ... (existing save logic from transcribeWithAssemblyAIEnhanced)

            res.json({
                success: true,
                message: 'Advanced transcription completed',
                data: {
                    transcript_id: transcript.id,
                    utterances_count: transcript.utterances?.length || 0,
                    highlights_count: transcript.auto_highlights_result?.results?.length || 0,
                    entities_count: transcript.entities?.length || 0,
                    chapters_count: transcript.chapters?.length || 0
                }
            });

        } catch (error) {
            console.error('❌ Advanced transcription error:', error);
            res.status(500).json({
                success: false,
                error: 'Advanced transcription failed: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ NEW: Delete Transcript
    // ================================================================
    app.delete('/api/transcripts/:transcript_id', authMiddleware, async (req, res) => {
        try {
            const { transcript_id } = req.params;

            // Verify ownership
            const audioFile = await queryOne(
                `SELECT af.*, m.user_id
                 FROM audio_files af
                 JOIN meetings m ON af.meeting_id = m.id
                 WHERE af.assembly_transcript_id = $1
                 AND m.user_id = $2
                 AND af.deleted_at IS NULL`,
                [transcript_id, req.userId]
            );

            if (!audioFile) {
                return res.status(404).json({
                    success: false,
                    error: 'Transcript not found or access denied'
                });
            }

            // Delete from AssemblyAI
            await assemblyClient.transcripts.delete(transcript_id);

            // Clear transcript ID from database
            await query(
                `UPDATE audio_files SET assembly_transcript_id = NULL
                 WHERE assembly_transcript_id = $1`,
                [transcript_id]
            );

            res.json({
                success: true,
                message: 'Transcript deleted successfully'
            });

        } catch (error) {
            console.error('❌ Delete transcript error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete transcript: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ NEW: Transcribe Audio Segment
    // ================================================================
    app.post('/api/meetings/:id/transcribe-segment', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const { start_ms, end_ms, language = 'id' } = req.body;

            if (!start_ms || !end_ms) {
                return res.status(400).json({
                    success: false,
                    error: 'start_ms and end_ms required'
                });
            }

            const audioFile = await queryOne(
                `SELECT * FROM audio_files
                 WHERE meeting_id = $1 AND deleted_at IS NULL
                 ORDER BY uploaded_at DESC LIMIT 1`,
                [id]
            );

            if (!audioFile) {
                return res.status(400).json({
                    success: false,
                    error: 'No audio file found'
                });
            }

            const transcript = await assemblyClient.transcripts.transcribe({
                audio: audioFile.file_path,
                language_code: language,
                audio_start_from: start_ms,
                audio_end_at: end_ms,
                speaker_labels: true
            });

            if (transcript.status === 'error') {
                throw new Error('Transcription failed: ' + transcript.error);
            }

            res.json({
                success: true,
                data: {
                    transcript_id: transcript.id,
                    text: transcript.text,
                    duration_ms: end_ms - start_ms,
                    utterances: transcript.utterances || []
                }
            });

        } catch (error) {
            console.error('❌ Segment transcription error:', error);
            res.status(500).json({
                success: false,
                error: 'Segment transcription failed: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ NEW: Generate Temporary Streaming Token
    // ================================================================
    app.post('/api/streaming/token', authMiddleware, async (req, res) => {
        try {
            const { expires_in = 3600 } = req.body; // Default 1 hour

            // Validate expires_in (1 second to 10 minutes)
            if (expires_in < 1 || expires_in > 600) {
                return res.status(400).json({
                    success: false,
                    error: 'expires_in must be between 1 and 600 seconds'
                });
            }

            const token = await assemblyClient.realtime.createTemporaryToken({
                expires_in: expires_in
            });

            res.json({
                success: true,
                data: {
                    token: token,
                    expires_in: expires_in,
                    expires_at: new Date(Date.now() + expires_in * 1000)
                }
            });

        } catch (error) {
            console.error('❌ Token generation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate token: ' + error.message
            });
        }
    });

    // ================================================================
    // ✅ NEW: Transcribe Multichannel Audio
    // ================================================================
    app.post('/api/meetings/:id/transcribe-multichannel', authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const { language = 'id' } = req.body;

            const audioFile = await queryOne(
                `SELECT * FROM audio_files
                 WHERE meeting_id = $1 AND deleted_at IS NULL
                 ORDER BY uploaded_at DESC LIMIT 1`,
                [id]
            );

            if (!audioFile) {
                return res.status(400).json({
                    success: false,
                    error: 'No audio file found'
                });
            }

            const transcript = await assemblyClient.transcripts.transcribe({
                audio: audioFile.file_path,
                language_code: language,
                multichannel: true,
                speaker_labels: true
            });

            if (transcript.status === 'error') {
                throw new Error('Transcription failed: ' + transcript.error);
            }

            // Store transcript ID
            await query(
                `UPDATE audio_files SET assembly_transcript_id = $1
                 WHERE id = $2`,
                [transcript.id, audioFile.id]
            );

            // Save utterances with channel information
            if (transcript.utterances && transcript.utterances.length > 0) {
                for (let i = 0; i < transcript.utterances.length; i++) {
                    const utterance = transcript.utterances[i];

                    await query(
                        `INSERT INTO transcripts
                         (meeting_id, text, start_time, end_time, speaker, confidence, sequence_number, sentiment, sentiment_score)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEUTRAL', 0.5)`,
                        [
                            id,
                            utterance.text,
                            utterance.start,
                            utterance.end,
                            `Channel ${utterance.channel || utterance.speaker}`,
                            utterance.confidence || 0.95,
                            i
                        ]
                    );
                }
            }

            res.json({
                success: true,
                message: 'Multichannel transcription completed',
                data: {
                    transcript_id: transcript.id,
                    audio_channels: transcript.audio_channels,
                    utterances_count: transcript.utterances?.length || 0
                }
            });

        } catch (error) {
            console.error('❌ Multichannel transcription error:', error);
            res.status(500).json({
                success: false,
                error: 'Multichannel transcription failed: ' + error.message
            });
        }
    });

    console.log('✅ AssemblyAI Enhanced Features initialized');
}

// Export functions
module.exports = {
    transcribeWithAssemblyAIEnhanced,
    setupEnhancements
};
