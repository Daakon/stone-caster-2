-- Minimal NPC creation test
-- This creates an NPC with only the fields that definitely exist

INSERT INTO public.npcs (name, description, status) 
VALUES ('Test NPC', 'A test NPC for debugging', 'active')
RETURNING *;
