-- ================================================================
-- naraMEET v2.0 ENHANCED - PostgreSQL Database Migration
-- ================================================================
-- Description: Complete database schema with AssemblyAI Enhanced Features
-- Version: 2.1.0 (ENHANCED)
-- Date: 2025-01-17
-- Author: naraMeet Team
-- New Features: Auto Highlights, Sentiment, Entities, Chapters, Recordings
-- ================================================================

-- Drop existing tables (if any) - BE CAREFUL IN PRODUCTION!
DROP TABLE IF EXISTS meeting_recordings CASCADE;
DROP TABLE IF EXISTS meeting_chapters CASCADE;
DROP TABLE IF EXISTS meeting_highlights CASCADE;
DROP TABLE IF EXISTS meeting_entities CASCADE;
DROP TABLE IF EXISTS exports CASCADE;
DROP TABLE IF EXISTS meeting_summaries CASCADE;
DROP TABLE IF EXISTS audio_files CASCADE;
DROP TABLE IF EXISTS transcripts CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enable UUID extension (for better IDs if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TABLE: users
-- ================================================================
-- Purpose: Store user accounts with authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- bcrypt hashed
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- admin, manager, user
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for users table
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- ================================================================
-- TABLE: contacts
-- ================================================================
-- Purpose: Store contact information for quick participant selection
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(255), -- Job title/role
    company VARCHAR(255),
    is_shared BOOLEAN DEFAULT false, -- Shared across all users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for contacts table
CREATE INDEX idx_contacts_user ON contacts(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_email ON contacts(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_name ON contacts(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_shared ON contacts(is_shared) WHERE deleted_at IS NULL;

-- ================================================================
-- TABLE: meetings
-- ================================================================
-- Purpose: Store meeting information and metadata
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    date TIMESTAMP NOT NULL,
    location VARCHAR(500),
    status VARCHAR(20) DEFAULT 'draft', -- draft, in_progress, completed, archived
    description TEXT,

    -- ✅ NEW: Jitsi Integration
    room_name VARCHAR(255) UNIQUE,
    jitsi_jwt_token TEXT,
    is_recording BOOLEAN DEFAULT false,
    recording_started_at TIMESTAMP,
    recording_ended_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for meetings table
CREATE INDEX idx_meetings_user ON meetings(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_status ON meetings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_date ON meetings(date) WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_room_name ON meetings(room_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_recording ON meetings(is_recording) WHERE deleted_at IS NULL;

-- Full text search index for meeting titles
CREATE INDEX idx_meetings_title_search ON meetings USING gin(to_tsvector('english', title)) WHERE deleted_at IS NULL;

-- ================================================================
-- TABLE: participants
-- ================================================================
-- Purpose: Store meeting participants/attendees
CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(255), -- position/role in meeting
    attended BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for participants table
CREATE INDEX idx_participants_meeting ON participants(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_participants_email ON participants(email) WHERE deleted_at IS NULL;

-- ================================================================
-- TABLE: transcripts
-- ================================================================
-- Purpose: Store audio transcriptions (speech-to-text results)
CREATE TABLE transcripts (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    speaker VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confidence_score DECIMAL(5,4) DEFAULT 0.0, -- 0.0000 to 1.0000
    start_time INTEGER, -- milliseconds from recording start
    end_time INTEGER, -- milliseconds from recording start
    is_edited BOOLEAN DEFAULT false,
    sequence_number INTEGER DEFAULT 0, -- Order of speech segments

    -- ✅ NEW: AssemblyAI Enhanced Features
    sentiment VARCHAR(20), -- POSITIVE, NEGATIVE, NEUTRAL
    sentiment_score DECIMAL(5,4), -- Sentiment confidence score

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for transcripts table
CREATE INDEX idx_transcripts_meeting ON transcripts(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transcripts_speaker ON transcripts(speaker) WHERE deleted_at IS NULL;
CREATE INDEX idx_transcripts_sequence ON transcripts(meeting_id, sequence_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_transcripts_sentiment ON transcripts(sentiment) WHERE deleted_at IS NULL;

-- Full text search for transcript content
CREATE INDEX idx_transcripts_text_search ON transcripts USING gin(to_tsvector('english', text)) WHERE deleted_at IS NULL;

-- ================================================================
-- TABLE: audio_files
-- ================================================================
-- Purpose: Store audio file metadata (not the actual file)
CREATE TABLE audio_files (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT, -- bytes
    duration INTEGER, -- seconds
    format VARCHAR(20), -- mp3, wav, m4a, etc
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT false,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    processing_error TEXT,

    -- ✅ NEW: AssemblyAI Integration
    assembly_transcript_id VARCHAR(255), -- Store AssemblyAI transcript ID for re-use
    assembly_upload_url TEXT, -- AssemblyAI upload URL

    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for audio_files table
CREATE INDEX idx_audio_meeting ON audio_files(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_audio_processed ON audio_files(processed) WHERE deleted_at IS NULL;
CREATE INDEX idx_audio_status ON audio_files(processing_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_audio_assembly_id ON audio_files(assembly_transcript_id) WHERE deleted_at IS NULL;

-- ================================================================
-- TABLE: meeting_summaries
-- ================================================================
-- Purpose: Store meeting summaries and action items
CREATE TABLE meeting_summaries (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER UNIQUE NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    key_points TEXT,
    action_items TEXT,
    decisions_made TEXT,
    next_meeting_date TIMESTAMP,
    next_meeting_agenda TEXT,

    -- ✅ NEW: LeMUR Metadata
    lemur_request_id VARCHAR(255),
    lemur_usage JSONB, -- Token usage info

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for meeting_summaries table
CREATE INDEX idx_summary_meeting ON meeting_summaries(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_summary_next_meeting ON meeting_summaries(next_meeting_date) WHERE deleted_at IS NULL;

-- ================================================================
-- ✅ NEW TABLE: meeting_highlights
-- ================================================================
-- Purpose: Store auto-detected highlights from meetings
CREATE TABLE meeting_highlights (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    count INTEGER DEFAULT 1, -- Number of times mentioned
    rank DECIMAL(5,4), -- Importance rank (0.0 to 1.0)
    timestamps JSONB, -- Array of {start, end} timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_highlights_meeting ON meeting_highlights(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_highlights_rank ON meeting_highlights(rank DESC) WHERE deleted_at IS NULL;

-- ================================================================
-- ✅ NEW TABLE: meeting_entities
-- ================================================================
-- Purpose: Store detected entities (names, dates, locations, etc.)
CREATE TABLE meeting_entities (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- person_name, location, date, organization, etc.
    text TEXT NOT NULL,
    start_time INTEGER, -- milliseconds
    end_time INTEGER, -- milliseconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_entities_meeting ON meeting_entities(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_entities_type ON meeting_entities(entity_type) WHERE deleted_at IS NULL;

-- ================================================================
-- ✅ NEW TABLE: meeting_chapters
-- ================================================================
-- Purpose: Store auto-generated chapters/topics
CREATE TABLE meeting_chapters (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    headline VARCHAR(500), -- Short chapter title
    summary TEXT, -- Chapter summary
    gist VARCHAR(255), -- Very short gist
    start_time INTEGER NOT NULL, -- milliseconds
    end_time INTEGER NOT NULL, -- milliseconds
    sequence_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_chapters_meeting ON meeting_chapters(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_chapters_sequence ON meeting_chapters(meeting_id, sequence_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_chapters_time ON meeting_chapters(meeting_id, start_time) WHERE deleted_at IS NULL;

-- ================================================================
-- ✅ NEW TABLE: meeting_recordings
-- ================================================================
-- Purpose: Store meeting recordings (video/audio)
CREATE TABLE meeting_recordings (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT, -- bytes
    duration INTEGER, -- seconds
    format VARCHAR(20), -- mp4, webm, etc
    mime_type VARCHAR(100),

    recording_type VARCHAR(20) DEFAULT 'video', -- video, audio
    status VARCHAR(50) DEFAULT 'recording', -- recording, processing, completed, failed

    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    processed_at TIMESTAMP,

    -- Auto-transcription
    auto_transcribed BOOLEAN DEFAULT false,
    transcription_completed_at TIMESTAMP,

    deleted_at TIMESTAMP
);

CREATE INDEX idx_recordings_meeting ON meeting_recordings(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_recordings_status ON meeting_recordings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_recordings_type ON meeting_recordings(recording_type) WHERE deleted_at IS NULL;

-- ================================================================
-- TABLE: exports
-- ================================================================
-- Purpose: Track export history
CREATE TABLE exports (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    export_type VARCHAR(20) NOT NULL, -- pdf, docx, csv, json, srt, vtt
    file_path VARCHAR(1000),
    file_size BIGINT, -- bytes
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for exports table
CREATE INDEX idx_exports_meeting ON exports(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_exports_user ON exports(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_exports_type ON exports(export_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_exports_date ON exports(exported_at DESC) WHERE deleted_at IS NULL;

-- ================================================================
-- FUNCTIONS: Auto-update timestamps
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply auto-update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcripts_updated_at BEFORE UPDATE ON transcripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_summaries_updated_at BEFORE UPDATE ON meeting_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- SEED DATA: Default admin user
-- ================================================================

-- Insert default admin user
-- Password: admin123 (bcrypt hashed)
INSERT INTO users (username, email, password, name, role, is_active, email_verified) VALUES
('admin', 'admin@narameet.com', '$2a$10$kuZ.TeXlz40rbwnyNqQhk.z/cRvcPmVJrs0iCq2FIp7LdaUKP1Y4a', 'Administrator', 'admin', true, true);

-- Insert sample user (optional - comment out if not needed)
-- Password: user123
INSERT INTO users (username, email, password, name, role, is_active, email_verified) VALUES
('user', 'user@narameet.com', '$2a$10$H7fR5ZqP.xQk.6YlPqX9aOVqE8GfPqJK5vI.MQwKdH5Y.LnLmEQ.a', 'Test User', 'user', true, true);

-- ================================================================
-- SAMPLE DATA: Contacts (optional)
-- ================================================================

-- Insert sample contacts for admin user
INSERT INTO contacts (user_id, name, email, phone, role, company, is_shared) VALUES
(1, 'John Doe', 'john@company.com', '+62 812-3456-7890', 'Project Manager', 'Tech Corp', true),
(1, 'Jane Smith', 'jane@company.com', '+62 813-4567-8901', 'Senior Developer', 'Tech Corp', true),
(1, 'Bob Johnson', 'bob@company.com', '+62 814-5678-9012', 'UX Designer', 'Design Studio', true),
(1, 'Alice Williams', 'alice@startup.com', '+62 815-6789-0123', 'CEO', 'StartupXYZ', false),
(1, 'Charlie Brown', 'charlie@agency.com', '+62 816-7890-1234', 'Marketing Director', 'Creative Agency', false);

-- ================================================================
-- SAMPLE DATA: Demo meeting (optional)
-- ================================================================

-- Insert sample meeting
INSERT INTO meetings (user_id, title, date, location, status, room_name, created_by) VALUES
(1, 'Sample Q4 Planning Meeting', '2025-01-15 14:00:00', 'Meeting Room A', 'completed', 'narameet-demo-q4-planning', 1);

-- Insert sample participants for demo meeting
INSERT INTO participants (meeting_id, name, email, phone, role, attended) VALUES
(1, 'John Doe', 'john@company.com', '+62 812-3456-7890', 'Project Manager', true),
(1, 'Jane Smith', 'jane@company.com', '+62 813-4567-8901', 'Developer', true),
(1, 'Bob Johnson', 'bob@company.com', '+62 814-5678-9012', 'Designer', true);

-- Insert sample transcript with sentiment
INSERT INTO transcripts (meeting_id, speaker, text, confidence_score, start_time, end_time, sequence_number, sentiment, sentiment_score) VALUES
(1, 'John Doe', 'Welcome everyone to our Q4 planning meeting. Today we will discuss our goals and objectives.', 0.95, 0, 5000, 1, 'POSITIVE', 0.87),
(1, 'Jane Smith', 'Thank you John. I would like to start with the technical roadmap for next quarter.', 0.92, 5000, 10000, 2, 'NEUTRAL', 0.65),
(1, 'Bob Johnson', 'Great! I have prepared some design mockups for the new features.', 0.94, 10000, 15000, 3, 'POSITIVE', 0.92);

-- Insert sample highlights
INSERT INTO meeting_highlights (meeting_id, text, count, rank, timestamps) VALUES
(1, 'Q4 planning', 3, 0.95, '[{"start": 0, "end": 5000}, {"start": 10000, "end": 15000}]'),
(1, 'technical roadmap', 2, 0.85, '[{"start": 5000, "end": 10000}]');

-- Insert sample entities
INSERT INTO meeting_entities (meeting_id, entity_type, text, start_time, end_time) VALUES
(1, 'person_name', 'John Doe', 0, 1000),
(1, 'person_name', 'Jane Smith', 5000, 6000),
(1, 'person_name', 'Bob Johnson', 10000, 11000),
(1, 'date', 'Q4', 2000, 2500);

-- Insert sample chapter
INSERT INTO meeting_chapters (meeting_id, headline, summary, gist, start_time, end_time, sequence_number) VALUES
(1, 'Meeting Introduction', 'John welcomes everyone and outlines the agenda for Q4 planning discussion', 'Q4 planning kickoff', 0, 5000, 1),
(1, 'Technical Discussion', 'Jane presents the technical roadmap for the upcoming quarter', 'Technical roadmap', 5000, 10000, 2);

-- Insert sample summary
INSERT INTO meeting_summaries (meeting_id, key_points, action_items, next_meeting_date, created_by) VALUES
(1,
'1. Q4 goals discussed and approved
2. Technical roadmap presented
3. Design mockups reviewed',
'1. John - Finalize budget allocation by next week
2. Jane - Complete technical specification document
3. Bob - Update design system documentation',
'2025-01-22 14:00:00',
1);

-- ================================================================
-- VIEWS: Useful database views
-- ================================================================

-- View: Complete meeting details with all counts
CREATE OR REPLACE VIEW v_meetings_overview AS
SELECT
    m.id,
    m.title,
    m.date,
    m.location,
    m.status,
    m.room_name,
    m.is_recording,
    m.created_at,
    m.updated_at,
    u.name as owner_name,
    u.email as owner_email,
    COUNT(DISTINCT p.id) as participant_count,
    COUNT(DISTINCT t.id) as transcript_count,
    COUNT(DISTINCT a.id) as audio_file_count,
    COUNT(DISTINCT h.id) as highlight_count,
    COUNT(DISTINCT e.id) as entity_count,
    COUNT(DISTINCT c.id) as chapter_count,
    COUNT(DISTINCT r.id) as recording_count,
    CASE WHEN s.id IS NOT NULL THEN true ELSE false END as has_summary
FROM meetings m
LEFT JOIN users u ON m.user_id = u.id
LEFT JOIN participants p ON m.id = p.meeting_id AND p.deleted_at IS NULL
LEFT JOIN transcripts t ON m.id = t.meeting_id AND t.deleted_at IS NULL
LEFT JOIN audio_files a ON m.id = a.meeting_id AND a.deleted_at IS NULL
LEFT JOIN meeting_highlights h ON m.id = h.meeting_id AND h.deleted_at IS NULL
LEFT JOIN meeting_entities e ON m.id = e.meeting_id AND e.deleted_at IS NULL
LEFT JOIN meeting_chapters c ON m.id = c.meeting_id AND c.deleted_at IS NULL
LEFT JOIN meeting_recordings r ON m.id = r.meeting_id AND r.deleted_at IS NULL
LEFT JOIN meeting_summaries s ON m.id = s.meeting_id AND s.deleted_at IS NULL
WHERE m.deleted_at IS NULL
GROUP BY m.id, u.id, s.id;

-- View: Sentiment analysis overview
CREATE OR REPLACE VIEW v_sentiment_overview AS
SELECT
    m.id as meeting_id,
    m.title,
    COUNT(*) as total_segments,
    SUM(CASE WHEN t.sentiment = 'POSITIVE' THEN 1 ELSE 0 END) as positive_count,
    SUM(CASE WHEN t.sentiment = 'NEGATIVE' THEN 1 ELSE 0 END) as negative_count,
    SUM(CASE WHEN t.sentiment = 'NEUTRAL' THEN 1 ELSE 0 END) as neutral_count,
    ROUND(AVG(CASE WHEN t.sentiment = 'POSITIVE' THEN 1.0
                   WHEN t.sentiment = 'NEGATIVE' THEN -1.0
                   ELSE 0.0 END), 2) as sentiment_score
FROM meetings m
JOIN transcripts t ON m.id = t.meeting_id
WHERE m.deleted_at IS NULL AND t.deleted_at IS NULL
GROUP BY m.id;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify tables created
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify new enhanced tables
SELECT
    'meeting_highlights' as table_name, COUNT(*) as row_count FROM meeting_highlights
UNION ALL
SELECT 'meeting_entities', COUNT(*) FROM meeting_entities
UNION ALL
SELECT 'meeting_chapters', COUNT(*) FROM meeting_chapters
UNION ALL
SELECT 'meeting_recordings', COUNT(*) FROM meeting_recordings;

-- Test the enhanced views
SELECT * FROM v_meetings_overview LIMIT 5;
SELECT * FROM v_sentiment_overview LIMIT 5;

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
-- ✅ NEW FEATURES ADDED:
-- 1. Auto Highlights (meeting_highlights table)
-- 2. Sentiment Analysis (sentiment columns in transcripts)
-- 3. Entity Detection (meeting_entities table)
-- 4. Auto Chapters (meeting_chapters table)
-- 5. Meeting Recordings (meeting_recordings table)
-- 6. Jitsi Integration (room_name, jwt_token in meetings)
-- 7. AssemblyAI Integration (assembly_transcript_id in audio_files)
-- ================================================================
