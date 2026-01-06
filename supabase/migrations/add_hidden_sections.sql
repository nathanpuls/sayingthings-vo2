-- Add hidden_sections column to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hidden_sections text[] DEFAULT '{}';
