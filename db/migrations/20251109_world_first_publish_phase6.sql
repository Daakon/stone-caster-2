-- Phase 6: Quality Gates, Admin Checklists, Creator Preflight
-- Additive-only migration

-- Publishing checklists for admin review feedback
create table if not exists publishing_checklists (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('world','story','npc')),
  entity_id uuid not null,
  reviewer_user_id uuid not null,
  items jsonb not null,  -- array of {key, label, checked, note?}
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_publishing_checklists_entity 
  on publishing_checklists(entity_type, entity_id, created_at desc);

-- Publishing quality findings (preflight and review)
create table if not exists publishing_quality_findings (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('world','story','npc')),
  entity_id uuid not null,
  kind text not null check (kind in ('preflight','review')),
  issues jsonb not null,  -- array of {code, severity, message, path?, tip?}
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_publishing_quality_findings_entity 
  on publishing_quality_findings(entity_type, entity_id, created_at desc);



