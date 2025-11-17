-- ================================================================
-- FIX MISSING SCHEMA - Safe Migration
-- ================================================================
-- Description: Adds missing tables and columns without dropping data
-- Date: 2025-11-17
-- ================================================================

-- ================================================================
-- FIX 1: Add missing ai_generated column to meeting_summaries
-- ================================================================
ALTER TABLE meeting_summaries
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;

-- ================================================================
-- FIX 2: Create contacts table if not exists
-- ================================================================
CREATE TABLE IF NOT EXISTS contacts (
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
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_shared ON contacts(is_shared) WHERE deleted_at IS NULL;

-- ================================================================
-- FIX 3: Ensure audio_files has assembly_transcript_id column
-- ================================================================
ALTER TABLE audio_files
ADD COLUMN IF NOT EXISTS assembly_transcript_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_audio_files_transcript_id
ON audio_files(assembly_transcript_id)
WHERE assembly_transcript_id IS NOT NULL;

-- ================================================================
-- Verify changes
-- ================================================================
SELECT
    'ai_generated column' as item,
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.columns
WHERE table_name = 'meeting_summaries' AND column_name = 'ai_generated'
UNION ALL
SELECT
    'contacts table' as item,
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables
WHERE table_name = 'contacts'
UNION ALL
SELECT
    'assembly_transcript_id column' as item,
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.columns
WHERE table_name = 'audio_files' AND column_name = 'assembly_transcript_id';

-- Success message
SELECT '🎉 Schema fixes applied successfully!' as message;
