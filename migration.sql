-- ================================================================
-- naraMEET v2.0 - PostgreSQL Database Migration
-- ================================================================
-- Description: Complete database schema for AI Meeting Minutes System
-- Version: 2.0.0
-- Date: 2025-01-17
-- Author: naraMeet Team
-- ================================================================

-- Drop existing tables (if any) - BE CAREFUL IN PRODUCTION!
DROP TABLE IF EXISTS exports CASCADE;
DROP TABLE IF EXISTS meeting_summaries CASCADE;
DROP TABLE IF EXISTS audio_files CASCADE;
DROP TABLE IF EXISTS transcripts CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for transcripts table
CREATE INDEX idx_transcripts_meeting ON transcripts(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transcripts_speaker ON transcripts(speaker) WHERE deleted_at IS NULL;
CREATE INDEX idx_transcripts_sequence ON transcripts(meeting_id, sequence_number) WHERE deleted_at IS NULL;

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
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for audio_files table
CREATE INDEX idx_audio_meeting ON audio_files(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_audio_processed ON audio_files(processed) WHERE deleted_at IS NULL;
CREATE INDEX idx_audio_status ON audio_files(processing_status) WHERE deleted_at IS NULL;

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
-- TABLE: exports
-- ================================================================
-- Purpose: Track export history (optional but useful)
CREATE TABLE exports (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    export_type VARCHAR(20) NOT NULL, -- pdf, docx, csv, json
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
-- SAMPLE DATA: Demo meeting (optional - comment out if not needed)
-- ================================================================

-- Insert sample meeting
INSERT INTO meetings (user_id, title, date, location, status, created_by) VALUES
(1, 'Sample Q4 Planning Meeting', '2025-01-15 14:00:00', 'Meeting Room A', 'completed', 1);

-- Insert sample participants for demo meeting
INSERT INTO participants (meeting_id, name, email, phone, role, attended) VALUES
(1, 'John Doe', 'john@company.com', '+62 812-3456-7890', 'Project Manager', true),
(1, 'Jane Smith', 'jane@company.com', '+62 813-4567-8901', 'Developer', true),
(1, 'Bob Johnson', 'bob@company.com', '+62 814-5678-9012', 'Designer', true);

-- Insert sample transcript
INSERT INTO transcripts (meeting_id, speaker, text, confidence_score, start_time, end_time, sequence_number) VALUES
(1, 'John Doe', 'Welcome everyone to our Q4 planning meeting. Today we will discuss our goals and objectives.', 0.95, 0, 5000, 1),
(1, 'Jane Smith', 'Thank you John. I would like to start with the technical roadmap for next quarter.', 0.92, 5000, 10000, 2),
(1, 'Bob Johnson', 'Great! I have prepared some design mockups for the new features.', 0.94, 10000, 15000, 3);

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

-- View: Complete meeting details with participant count
CREATE OR REPLACE VIEW v_meetings_overview AS
SELECT 
    m.id,
    m.title,
    m.date,
    m.location,
    m.status,
    m.created_at,
    m.updated_at,
    u.name as owner_name,
    u.email as owner_email,
    COUNT(DISTINCT p.id) as participant_count,
    COUNT(DISTINCT t.id) as transcript_count,
    COUNT(DISTINCT a.id) as audio_file_count,
    CASE WHEN s.id IS NOT NULL THEN true ELSE false END as has_summary
FROM meetings m
LEFT JOIN users u ON m.user_id = u.id
LEFT JOIN participants p ON m.id = p.meeting_id AND p.deleted_at IS NULL
LEFT JOIN transcripts t ON m.id = t.meeting_id AND t.deleted_at IS NULL
LEFT JOIN audio_files a ON m.id = a.meeting_id AND a.deleted_at IS NULL
LEFT JOIN meeting_summaries s ON m.id = s.meeting_id AND s.deleted_at IS NULL
WHERE m.deleted_at IS NULL
GROUP BY m.id, u.id, s.id;

-- View: Recent activity log
CREATE OR REPLACE VIEW v_recent_activities AS
SELECT 
    'meeting_created' as activity_type,
    m.id as item_id,
    m.title as item_name,
    u.name as user_name,
    m.created_at as activity_time
FROM meetings m
JOIN users u ON m.user_id = u.id
WHERE m.deleted_at IS NULL
UNION ALL
SELECT 
    'export_created' as activity_type,
    e.id as item_id,
    e.export_type as item_name,
    u.name as user_name,
    e.exported_at as activity_time
FROM exports e
JOIN users u ON e.user_id = u.id
WHERE e.deleted_at IS NULL
ORDER BY activity_time DESC
LIMIT 50;

-- ================================================================
-- PERMISSIONS & SECURITY (Production)
-- ================================================================

-- Grant permissions to narameet user (already has full access as database owner)
-- If you need to create additional read-only users, use:
-- CREATE USER narameet_readonly WITH PASSWORD 'readonly_password';
-- GRANT CONNECT ON DATABASE narameet TO narameet_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO narameet_readonly;

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

-- Verify indexes created
SELECT 
    tablename, 
    indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Verify sample data inserted
SELECT 
    'Users' as table_name, 
    COUNT(*) as row_count 
FROM users
UNION ALL
SELECT 
    'Meetings' as table_name, 
    COUNT(*) as row_count 
FROM meetings
UNION ALL
SELECT 
    'Participants' as table_name, 
    COUNT(*) as row_count 
FROM participants
UNION ALL
SELECT 
    'Transcripts' as table_name, 
    COUNT(*) as row_count 
FROM transcripts;

-- Test the view
SELECT * FROM v_meetings_overview LIMIT 5;

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
-- Next steps:
-- 1. Copy this file to your project directory
-- 2. Run in pgAdmin or psql:
--    psql -U narameet -d narameet -f migration.sql
-- 3. Verify all tables created
-- 4. Update backend code to use database
-- 5. Test the application!
-- ================================================================
