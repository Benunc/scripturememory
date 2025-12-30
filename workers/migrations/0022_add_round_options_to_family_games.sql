-- Add round_options column to family_game_rounds table
-- This stores all word options that will be shown for the entire round
ALTER TABLE family_game_rounds ADD COLUMN round_options TEXT;

