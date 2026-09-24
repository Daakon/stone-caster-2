-- 20260108_rename_director_narrator.sql
-- Phase 2: Rename MAS-1/MAS-2 columns to Director/Narrator nomenclature
-- This migration renames chimera_turns columns to align with the new architecture

-- Rename mas1_intent to director_intent
do $$
begin
    if exists (select 1 from information_schema.columns 
               where table_name = 'chimera_turns' and column_name = 'mas1_intent') then
        alter table chimera_turns rename column mas1_intent to director_intent;
    end if;
end $$;

-- Rename mas2_narration to narrator_output
do $$
begin
    if exists (select 1 from information_schema.columns 
               where table_name = 'chimera_turns' and column_name = 'mas2_narration') then
        alter table chimera_turns rename column mas2_narration to narrator_output;
    end if;
end $$;

-- Add comment to document the change
comment on column chimera_turns.director_intent is 'Unified Intent DTO from Director (Intent Queue, Unseen Ripples, Proximity Cluster)';
comment on column chimera_turns.narrator_output is 'Final prose and hints from Narrator';
