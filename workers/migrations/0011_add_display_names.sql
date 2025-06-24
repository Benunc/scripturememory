-- Add display_name column to group_members table
ALTER TABLE group_members ADD COLUMN display_name TEXT;

-- Add is_public column for privacy controls
ALTER TABLE group_members ADD COLUMN is_public BOOLEAN DEFAULT TRUE;

-- Add index for display name lookups
CREATE INDEX IF NOT EXISTS idx_group_members_display_name ON group_members(display_name);

-- Update existing members to have display names (use email prefix as default)
UPDATE group_members 
SET display_name = (
  SELECT SUBSTR(u.email, 1, INSTR(u.email, '@') - 1) 
  FROM users u 
  WHERE u.id = group_members.user_id
)
WHERE display_name IS NULL; 