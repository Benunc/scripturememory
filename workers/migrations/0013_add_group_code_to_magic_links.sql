-- Add group_code column to magic_links table
ALTER TABLE magic_links ADD COLUMN group_code TEXT;

-- Create index for fast lookups by group code
CREATE INDEX IF NOT EXISTS idx_magic_links_group_code ON magic_links(group_code); 