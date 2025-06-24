-- Add invitation_code column to group_invitations table
ALTER TABLE group_invitations ADD COLUMN invitation_code TEXT;

-- Create index for fast lookups by invitation code
CREATE INDEX IF NOT EXISTS idx_group_invitations_code ON group_invitations(invitation_code);

-- Update existing invitations to have codes (for backward compatibility)
-- This will be handled by the application logic when invitations are accessed 