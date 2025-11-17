-- ================================================================
-- ADD JITSI FIELDS TO MEETINGS TABLE
-- naraMeet Jitsi Integration Migration
-- ================================================================

-- Add Jitsi columns to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS jitsi_room_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS jitsi_token TEXT,
ADD COLUMN IF NOT EXISTS jitsi_meeting_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS jitsi_meeting_ended_at TIMESTAMP;

-- Add AI summary flag (bonus)
ALTER TABLE meeting_summaries
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_jitsi_room 
ON meetings(jitsi_room_name) 
WHERE deleted_at IS NULL;

-- Add helpful comments
COMMENT ON COLUMN meetings.jitsi_room_name IS 'Jitsi meeting room name';
COMMENT ON COLUMN meetings.jitsi_token IS 'JWT token for Jitsi authentication';
COMMENT ON COLUMN meetings.jitsi_meeting_started_at IS 'When video conference started';
COMMENT ON COLUMN meetings.jitsi_meeting_ended_at IS 'When video conference ended';

-- Verify columns added
SELECT 
    column_name, 
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name LIKE 'jitsi%'
ORDER BY column_name;

-- Success message
SELECT 'Jitsi fields added successfully! ✅' as status;
