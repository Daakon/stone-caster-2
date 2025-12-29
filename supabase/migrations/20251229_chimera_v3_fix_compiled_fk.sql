-- Fix Circular Foreign Key Constraint
-- We need to allow deleting chimera_compiled_stories even if linked by chimera_stories.current_compiled_id
-- This requires ON DELETE SET NULL

ALTER TABLE chimera_stories
DROP CONSTRAINT IF EXISTS chimera_stories_current_compiled_id_fkey;

ALTER TABLE chimera_stories
ADD CONSTRAINT chimera_stories_current_compiled_id_fkey
FOREIGN KEY (current_compiled_id)
REFERENCES chimera_compiled_stories(id)
ON DELETE SET NULL;
