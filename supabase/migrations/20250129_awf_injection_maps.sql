-- AWF Injection Maps Migration
-- Versioned injection map registry with admin-only RLS

create table if not exists public.injection_maps (
  id text not null,                -- e.g. "im.default"
  version text not null,           -- semver string
  label text not null,             -- human name in admin
  doc jsonb not null,              -- array of rules
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, version)
);

create index if not exists injection_maps_active_idx on public.injection_maps (is_active);
create index if not exists injection_maps_id_idx on public.injection_maps (id);

alter table public.injection_maps enable row level security;

-- Admin-only RLS policies
do $$
begin
  if not exists (select 1 from pg_policies where tablename='injection_maps' and policyname='awf_im_admin_select') then
    create policy awf_im_admin_select on public.injection_maps
      for select using (exists (select 1 from public.user_profiles up where up.auth_user_id = auth.uid() and up.role in ('admin')));
  end if;
  if not exists (select 1 from pg_policies where tablename='injection_maps' and policyname='awf_im_admin_write') then
    create policy awf_im_admin_write on public.injection_maps
      for all using (exists (select 1 from public.user_profiles up where up.auth_user_id = auth.uid() and up.role in ('admin')));
  end if;
end $$;

-- Add trigger to update updated_at timestamp
create or replace function update_injection_maps_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

create trigger injection_maps_touch_updated_at
before update on public.injection_maps
for each row execute procedure update_injection_maps_updated_at();

-- Add comments
comment on table public.injection_maps is 'Versioned injection map registry for AWF bundle assembly';
comment on column public.injection_maps.id is 'Unique identifier for the injection map (e.g., im.default)';
comment on column public.injection_maps.version is 'Semantic version string (e.g., 1.0.0)';
comment on column public.injection_maps.label is 'Human-readable name for admin interface';
comment on column public.injection_maps.doc is 'JSONB document containing injection rules array';
comment on column public.injection_maps.is_active is 'Whether this version is currently active (only one can be active)';
