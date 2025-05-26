-- Add status column to verses table
ALTER TABLE verses ADD COLUMN status TEXT NOT NULL DEFAULT 'not_started'; 