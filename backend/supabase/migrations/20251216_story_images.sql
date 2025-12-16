-- Migration: Add image and description support to stories
-- Date: 2025-12-16

ALTER TABLE chimera_stories 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;
