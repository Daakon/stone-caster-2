-- Create chimera_player_characters table
create table if not exists chimera_player_characters (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  state_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Ensure world_id exists (critical patch)
ALTER TABLE chimera_player_characters 
ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES chimera_worlds(id);

-- Enable RLS
alter table chimera_player_characters enable row level security;

-- Policies
create policy "Users can view their own characters"
  on chimera_player_characters for select
  using (auth.uid() = user_id);

create policy "Users can insert their own characters"
  on chimera_player_characters for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own characters"
  on chimera_player_characters for update
  using (auth.uid() = user_id);

create policy "Users can delete their own characters"
  on chimera_player_characters for delete
  using (auth.uid() = user_id);

-- Add index on user_id and world_id for faster lookups
create index if not exists idx_chimera_player_characters_user_id on chimera_player_characters(user_id);
create index if not exists idx_chimera_player_characters_world_id on chimera_player_characters(world_id);
