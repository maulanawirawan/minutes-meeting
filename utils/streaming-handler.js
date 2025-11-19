/**
 * 🌊 AssemblyAI Streaming API Handler
 * Real-time Speech-to-Text dengan WebSocket
 *
 * Features:
 * - Real-time transcription
 * - Turn detection (end-of-turn)
 * - Keyterms prompting
 * - Multilingual support
 * - Word-level timestamps
 */

const WebSocket = require('ws');

/**
 * Session Manager untuk tracking active streaming sessions
 */
class StreamingSessionManager {
    constructor() {
        this.activeSessions = new Map(); // sessionId -> session data
    }

    createSession(sessionId, meetingId, userId, config = {}) {
        const session = {
            sessionId,
            meetingId,
            userId,
            startTime: Date.now(),
            transcripts: [],
            turns: [],
            config,
            status: 'active'
        };

        this.activeSessions.set(sessionId, session);
        console.log(`✅ Session created: ${sessionId} for meeting ${meetingId}`);
        return session;
    }

    getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }

    updateSession(sessionId, updates) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            Object.assign(session, updates);
        }
    }

    endSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.status = 'ended';
            session.endTime = Date.now();
            session.duration = session.endTime - session.startTime;

            // Keep session for 5 minutes for retrieval
            setTimeout(() => {
                this.activeSessions.delete(sessionId);
                console.log(`🗑️ Session cleaned up: ${sessionId}`);
            }, 5 * 60 * 1000);

            return session;
        }
        return null;
    }

    getAllSessions(userId) {
        return Array.from(this.activeSessions.values())
            .filter(s => s.userId === userId);
    }
}

/**
 * Initialize WebSocket Server untuk Streaming
 */
function initializeStreamingWebSocket(server, assemblyClient, query, queryOne) {
    const wss = new WebSocket.Server({
        server,
        path: '/api/streaming/ws'
    });

    const sessionManager = new StreamingSessionManager();

    wss.on('connection', async (clientWs, req) => {
        console.log('🔌 New streaming WebSocket connection');

        let assemblyWs = null;
        let sessionId = null;
        let meetingId = null;
        let userId = null;
        let currentTurns = [];

        // Handle messages from client
        clientWs.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());

                // ======== START SESSION ========
                if (data.type === 'start_session') {
                    const {
                        meeting_id,
                        user_id,
                        sample_rate = 16000,
                        format_turns = true,
                        keyterms = [],
                        language_code = null,
                        turn_detection = 'balanced' // 'aggressive', 'balanced', 'conservative'
                    } = data;

                    meetingId = meeting_id;
                    userId = user_id;

                    // Validate meeting exists
                    const meeting = await queryOne(
                        'SELECT id FROM meetings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
                        [meeting_id, user_id]
                    );

                    if (!meeting) {
                        clientWs.send(JSON.stringify({
                            type: 'error',
                            message: 'Meeting not found or access denied'
                        }));
                        return;
                    }

                    // Get keyterms from participants and meeting title
                    let allKeyterms = [...keyterms];

                    const participants = await query(
                        'SELECT name FROM participants WHERE meeting_id = $1 AND deleted_at IS NULL',
                        [meeting_id]
                    );

                    allKeyterms = [...allKeyterms, ...participants.rows.map(p => p.name)];

                    const meetingData = await queryOne(
                        'SELECT title FROM meetings WHERE id = $1',
                        [meeting_id]
                    );

                    if (meetingData && meetingData.title) {
                        const titleWords = meetingData.title.split(' ').filter(w => w.length > 3);
                        allKeyterms = [...allKeyterms, ...titleWords];
                    }

                    // Limit to 100 keyterms (AssemblyAI limit)
                    allKeyterms = allKeyterms.slice(0, 100);

                    console.log(`📝 Keyterms (${allKeyterms.length}): ${allKeyterms.join(', ')}`);

                    // Turn detection presets
                    let turnConfig = {};
                    switch (turn_detection) {
                        case 'aggressive':
                            turnConfig = {
                                end_of_turn_confidence_threshold: 0.4,
                                min_end_of_turn_silence_when_confident: 160,
                                max_turn_silence: 400
                            };
                            break;
                        case 'conservative':
                            turnConfig = {
                                end_of_turn_confidence_threshold: 0.7,
                                min_end_of_turn_silence_when_confident: 800,
                                max_turn_silence: 3600
                            };
                            break;
                        default: // balanced
                            turnConfig = {
                                end_of_turn_confidence_threshold: 0.4,
                                min_end_of_turn_silence_when_confident: 400,
                                max_turn_silence: 1280
                            };
                    }

                    // Build WebSocket URL with parameters
                    const params = new URLSearchParams({
                        sample_rate: sample_rate.toString(),
                        format_turns: format_turns.toString(),
                        ...(language_code && { language_code }),
                        ...(allKeyterms.length > 0 && { keyterms_prompt: JSON.stringify(allKeyterms) }),
                        ...turnConfig
                    });

                    const wsUrl = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;

                    console.log(`🌊 Connecting to AssemblyAI streaming: ${wsUrl}`);

                    // Connect to AssemblyAI streaming
                    assemblyWs = new WebSocket(wsUrl, {
                        headers: {
                            'Authorization': process.env.ASSEMBLYAI_API_KEY
                        }
                    });

                    // AssemblyAI WebSocket events
                    assemblyWs.on('open', () => {
                        console.log('✅ Connected to AssemblyAI streaming');

                        // Create session
                        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        sessionManager.createSession(sessionId, meeting_id, user_id, {
                            sample_rate,
                            format_turns,
                            keyterms: allKeyterms,
                            turn_detection
                        });

                        clientWs.send(JSON.stringify({
                            type: 'session_started',
                            session_id: sessionId,
                            message: 'Streaming session started successfully'
                        }));
                    });

                    assemblyWs.on('message', (assemblyMessage) => {
                        try {
                            const assemblyData = JSON.parse(assemblyMessage.toString());

                            // Handle different message types
                            if (assemblyData.type === 'Begin') {
                                console.log(`🎬 AssemblyAI Session Begin: ${assemblyData.id}`);
                                console.log(`⏰ Expires at: ${new Date(assemblyData.expires_at * 1000).toISOString()}`);

                                // Update session with AssemblyAI session ID
                                sessionManager.updateSession(sessionId, {
                                    assemblySessionId: assemblyData.id,
                                    expiresAt: assemblyData.expires_at
                                });

                                // Forward to client
                                clientWs.send(JSON.stringify({
                                    type: 'session_begin',
                                    assembly_session_id: assemblyData.id,
                                    expires_at: assemblyData.expires_at
                                }));
                            }
                            else if (assemblyData.type === 'Turn') {
                                // Real-time transcription turn
                                const turn = {
                                    turn_order: assemblyData.turn_order,
                                    transcript: assemblyData.transcript,
                                    utterance: assemblyData.utterance,
                                    is_formatted: assemblyData.turn_is_formatted,
                                    end_of_turn: assemblyData.end_of_turn,
                                    confidence: assemblyData.end_of_turn_confidence,
                                    words: assemblyData.words,
                                    timestamp: Date.now()
                                };

                                // Store turn
                                currentTurns.push(turn);

                                // Update session
                                const session = sessionManager.getSession(sessionId);
                                if (session) {
                                    session.turns = currentTurns;
                                    if (assemblyData.utterance && assemblyData.utterance.length > 0) {
                                        session.transcripts.push({
                                            text: assemblyData.utterance,
                                            turn_order: assemblyData.turn_order,
                                            timestamp: Date.now()
                                        });
                                    }
                                }

                                // Forward to client
                                clientWs.send(JSON.stringify({
                                    type: 'turn',
                                    data: turn
                                }));

                                // If it's end of turn and formatted, save to database
                                if (assemblyData.end_of_turn && assemblyData.turn_is_formatted && meeting_id) {
                                    saveTranscriptTurn(
                                        query,
                                        meeting_id,
                                        assemblyData.transcript,
                                        assemblyData.turn_order,
                                        assemblyData.words
                                    ).catch(err => {
                                        console.error('Error saving turn:', err);
                                    });
                                }
                            }
                            else if (assemblyData.type === 'Termination') {
                                console.log('🛑 AssemblyAI session terminated');
                                console.log(`📊 Audio duration: ${assemblyData.audio_duration_seconds}s`);
                                console.log(`⏱️ Session duration: ${assemblyData.session_duration_seconds}s`);

                                const session = sessionManager.endSession(sessionId);

                                clientWs.send(JSON.stringify({
                                    type: 'session_terminated',
                                    audio_duration: assemblyData.audio_duration_seconds,
                                    session_duration: assemblyData.session_duration_seconds,
                                    total_turns: currentTurns.length,
                                    session_data: session
                                }));
                            }
                            else {
                                // Forward other messages to client
                                clientWs.send(assemblyMessage);
                            }
                        } catch (err) {
                            console.error('Error processing AssemblyAI message:', err);
                        }
                    });

                    assemblyWs.on('error', (error) => {
                        console.error('❌ AssemblyAI WebSocket error:', error);
                        clientWs.send(JSON.stringify({
                            type: 'error',
                            message: 'AssemblyAI connection error: ' + error.message
                        }));
                    });

                    assemblyWs.on('close', (code, reason) => {
                        console.log(`🔌 AssemblyAI WebSocket closed: ${code} - ${reason}`);
                        sessionManager.endSession(sessionId);
                        clientWs.send(JSON.stringify({
                            type: 'assembly_closed',
                            code,
                            reason: reason.toString()
                        }));
                    });
                }
                // ======== STREAM AUDIO ========
                else if (data.type === 'audio_data') {
                    // Forward audio to AssemblyAI (as binary)
                    if (assemblyWs && assemblyWs.readyState === WebSocket.OPEN) {
                        const audioBuffer = Buffer.from(data.audio, 'base64');
                        assemblyWs.send(audioBuffer);
                    } else {
                        clientWs.send(JSON.stringify({
                            type: 'error',
                            message: 'Streaming session not active'
                        }));
                    }
                }
                // ======== END SESSION ========
                else if (data.type === 'end_session') {
                    if (assemblyWs) {
                        // Send termination message
                        assemblyWs.send(JSON.stringify({ type: 'Terminate' }));

                        // Close after short delay
                        setTimeout(() => {
                            if (assemblyWs.readyState === WebSocket.OPEN) {
                                assemblyWs.close();
                            }
                        }, 1000);
                    }

                    const session = sessionManager.endSession(sessionId);

                    clientWs.send(JSON.stringify({
                        type: 'session_ended',
                        message: 'Streaming session ended',
                        session_data: session
                    }));
                }
                // ======== GET SESSION DATA ========
                else if (data.type === 'get_session') {
                    const session = sessionManager.getSession(data.session_id);
                    clientWs.send(JSON.stringify({
                        type: 'session_data',
                        session: session || null
                    }));
                }
            } catch (err) {
                console.error('❌ Error handling client message:', err);
                clientWs.send(JSON.stringify({
                    type: 'error',
                    message: err.message
                }));
            }
        });

        clientWs.on('close', () => {
            console.log('👋 Client WebSocket closed');
            if (assemblyWs && assemblyWs.readyState === WebSocket.OPEN) {
                assemblyWs.send(JSON.stringify({ type: 'Terminate' }));
                assemblyWs.close();
            }
            if (sessionId) {
                sessionManager.endSession(sessionId);
            }
        });

        clientWs.on('error', (error) => {
            console.error('❌ Client WebSocket error:', error);
        });
    });

    console.log('✅ Streaming WebSocket server initialized on /api/streaming/ws');
    return { wss, sessionManager };
}

/**
 * Save transcript turn to database
 */
async function saveTranscriptTurn(query, meetingId, transcript, turnOrder, words) {
    try {
        // Detect speaker from words (first word's speaker)
        const speaker = words && words.length > 0 ? words[0].speaker : 'Unknown';

        // Calculate start and end times
        const startTime = words && words.length > 0 ? words[0].start : 0;
        const endTime = words && words.length > 0 ? words[words.length - 1].end : 0;

        // Calculate average confidence
        const avgConfidence = words && words.length > 0
            ? words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length
            : 0;

        await query(
            `INSERT INTO transcripts (meeting_id, speaker, text, start_time, end_time, sequence_number, confidence_score, sentiment, sentiment_score)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEUTRAL', 0.5)`,
            [
                meetingId,
                speaker,
                transcript,
                startTime,
                endTime,
                turnOrder,
                avgConfidence
            ]
        );

        console.log(`💾 Saved turn ${turnOrder} to database`);
    } catch (error) {
        console.error('Error saving turn to database:', error);
        throw error;
    }
}

module.exports = {
    initializeStreamingWebSocket,
    StreamingSessionManager
};
