-- Videos Recording Table
-- Table for storing user video recordings with metadata

CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY, -- video_[timestamp]_[random] format
    upload_id TEXT NOT NULL, -- upload_[timestamp]_[random] format
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    duration DECIMAL(10,2) DEFAULT 0, -- in seconds
    format TEXT NOT NULL, -- webm, mp4, etc.
    quality TEXT NOT NULL, -- low, medium, high, lossless
    resolution JSONB, -- {width: number, height: number}
    thumbnail_path TEXT, -- path to thumbnail image
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded, processing, processed, error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_format CHECK (format IN ('webm', 'mp4', 'wav', 'mp3', 'quicktime')),
    CONSTRAINT valid_quality CHECK (quality IN ('low', 'medium', 'high', 'lossless')),
    CONSTRAINT valid_status CHECK (status IN ('uploaded', 'processing', 'processed', 'error')),
    CONSTRAINT positive_file_size CHECK (file_size > 0),
    CONSTRAINT positive_duration CHECK (duration >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_upload_id ON videos(upload_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_format ON videos(format);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_file_size ON videos(file_size);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own videos"
    ON videos FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own videos"
    ON videos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own videos"
    ON videos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos"
    ON videos FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos"
    ON videos FOR DELETE
    USING (auth.uid() = user_id);

-- Update videos table in utils/supabaseClient.ts constant
COMMENT ON TABLE videos IS 'User video recordings with metadata and processing status';
COMMENT ON COLUMN videos.id IS 'Unique video identifier in format video_[timestamp]_[random]';
COMMENT ON COLUMN videos.upload_id IS 'Upload session identifier in format upload_[timestamp]_[random]';
COMMENT ON COLUMN videos.file_path IS 'Path to video file in Supabase storage';
COMMENT ON COLUMN videos.duration IS 'Video duration in seconds';
COMMENT ON COLUMN videos.resolution IS 'Video resolution as JSON object with width and height';
COMMENT ON COLUMN videos.thumbnail_path IS 'Path to thumbnail image in Supabase storage';
COMMENT ON COLUMN videos.metadata IS 'Additional video metadata including upload info and processing results';