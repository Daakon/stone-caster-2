-- 20260107_refactor_gamestate.sql
-- Refactoring chimera_game_states and creating chimera_turns

-- 1. Refactor chimera_game_states
-- Remove the monolithic state_json and replace with sharded columns
-- We assume this is a breaking change for existing active games (which is acceptable for MVP/Dev)

-- Check if columns exist before adding/dropping to allow re-running (idempotency attempt)
do $$
begin
    -- Drop state_json if it exists
    if exists (select 1 from information_schema.columns where table_name = 'chimera_game_states' and column_name = 'state_json') then
        alter table chimera_game_states drop column state_json;
    end if;
end $$;

-- Drop PK if it's the old composite (session_id, turn_index)
alter table chimera_game_states drop constraint if exists chimera_game_states_pkey cascade;
-- Remove old columns if they exist from previous versions to clean up
alter table chimera_game_states drop column if exists session_id;
alter table chimera_game_states drop column if exists turn_index;

-- Add new columns if they don't exist
alter table chimera_game_states
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists mechanical_state jsonb not null default '{}'::jsonb,
    add column if not exists narrative_focus jsonb not null default '{}'::jsonb,
    add column if not exists scene_registry jsonb not null default '{}'::jsonb,
    add column if not exists action_queue jsonb not null default '[]'::jsonb,
    add column if not exists compiled_system_prompt text;

-- Backfill ID if needed (for existing rows where id might be null)
update chimera_game_states set id = gen_random_uuid() where id is null;

-- Ensure ID is NOT NULL
alter table chimera_game_states alter column id set not null;

-- Explicitly add Primary Key constraint
-- We use a DO block to avoid error if it was already created by a partial run
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'chimera_game_states_pkey') then
        alter table chimera_game_states add constraint chimera_game_states_pkey primary key (id);
    end if;
end $$;

-- Ensure indexes
create index if not exists idx_chimera_game_states_mechanical on chimera_game_states using gin (mechanical_state);
create index if not exists idx_chimera_game_states_player_id on chimera_game_states (player_id);
create index if not exists idx_chimera_game_states_story_id on chimera_game_states (story_id);


-- 2. Create chimera_turns (Game Log)
create table if not exists chimera_turns (
    id uuid primary key default gen_random_uuid(),
    game_state_id uuid not null references chimera_game_states(id) on delete cascade,
    turn_index int not null,
    player_input text not null,
    mas1_intent jsonb default '{}'::jsonb,     -- The interpreted action
    mechanical_delta jsonb default '{}'::jsonb, -- The engine's changes
    mas2_narration jsonb default '{}'::jsonb,   -- The final story output
    created_at timestamptz not null default now()
);

-- Index for fast log retrieval
create index if not exists idx_chimera_turns_lookup on chimera_turns (game_state_id, turn_index);


-- 3. Update ai_audit_logs (Telemetry)
-- Ensure table exists first (it should, but just in case)
create table if not exists ai_audit_logs (
    id uuid primary key default gen_random_uuid(),
    action_type text not null,
    model_used text,
    prompt_tokens int,
    completion_tokens int,
    cost_stones int,
    raw_response text,
    created_at timestamptz not null default now()
);

-- Add turn_id column linking to chimera_turns
alter table ai_audit_logs
    add column if not exists turn_id uuid references chimera_turns(id) on delete set null;

create index if not exists idx_ai_audit_logs_turn on ai_audit_logs (turn_id);
