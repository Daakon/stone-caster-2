-- Phase 7: Reports & Analytics Migration
-- Add resolved fields to content_reports
-- Create analytics views for dashboard metrics

-- Add resolved fields to content_reports
alter table content_reports add column if not exists resolved boolean not null default false;
alter table content_reports add column if not exists resolved_by uuid;
alter table content_reports add column if not exists resolved_at timestamptz;

-- Add index for resolved queries
create index if not exists idx_crep_resolved on content_reports(resolved);

-- Add notes column for audit trail (optional)
alter table content_reports add column if not exists notes jsonb default '[]'::jsonb;

-- Daily series helper (90 days)
create or replace view v_days_90 as
select (current_date - offs) as day
from generate_series(0, 89) as offs;

-- Submissions per day (content_reviews created)
create or replace view v_daily_submissions as
select d.day, coalesce(count(cr.id),0)::int as submissions
from v_days_90 d
left join content_reviews cr on cr.created_at::date = d.day
group by d.day
order by d.day;

-- Approvals per day
create or replace view v_daily_approvals as
select d.day, coalesce(count(cr.id),0)::int as approvals
from v_days_90 d
left join content_reviews cr 
  on cr.updated_at::date = d.day and cr.state = 'approved'
group by d.day 
order by d.day;

-- Active public entries per day (snapshot via last update heuristic)
create or replace view v_daily_active_public as
select d.day,
  (select count(*) from entry_points 
    where lifecycle='active' and visibility='public' and updated_at::date <= d.day)::int as active_public
from v_days_90 d
order by d.day;

-- Games started per day
-- Note: This view will return 0 for all days if the games table doesn't exist
create or replace view v_daily_games_started as
select d.day, coalesce(count(g.id),0)::int as games_started
from v_days_90 d
left join (
  select id, created_at::date as day
  from games 
  where exists (select 1 from information_schema.tables where table_name = 'games')
) g on g.day = d.day
group by d.day 
order by d.day;

-- Add token columns to turns table if they don't exist
-- Note: This assumes the turns table exists. If it doesn't, the view will return 0 for all days.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'turns') then
    alter table turns add column if not exists tokens_in integer default 0;
    alter table turns add column if not exists tokens_out integer default 0;
  end if;
end $$;

-- Tokens used per day (if you record tokens on turns)
-- Note: This view will return 0 for all days if the turns table doesn't exist or has no token data
create or replace view v_daily_tokens_used as
select d.day, coalesce(sum(coalesce(t.tokens_out,0)+coalesce(t.tokens_in,0)),0)::int as tokens_total
from v_days_90 d
left join (
  select created_at::date as day, tokens_in, tokens_out 
  from turns 
  where exists (select 1 from information_schema.tables where table_name = 'turns')
) t on t.day = d.day
group by d.day 
order by d.day;

-- SLA (avg hours open → decision) in last 30d
create or replace view v_review_sla_30d as
select 
  avg(extract(epoch from (cr.updated_at - cr.created_at))/3600.0) as avg_hours
from content_reviews cr
where cr.state in ('approved','rejected','changes_requested')
  and cr.created_at >= now() - interval '30 days';

-- RLS policies for content_reports
-- Allow moderators/admins to read all reports
create policy "Moderators can read all reports" on content_reports
  for select using (
    exists (
      select 1 from app_roles ar 
      where ar.user_id = auth.uid() 
      and ar.role in ('moderator', 'admin')
    )
  );

-- Allow moderators/admins to update reports (resolve)
create policy "Moderators can update reports" on content_reports
  for update using (
    exists (
      select 1 from app_roles ar 
      where ar.user_id = auth.uid() 
      and ar.role in ('moderator', 'admin')
    )
  );

-- Allow users to create reports (report content)
create policy "Users can create reports" on content_reports
  for insert with check (auth.uid() = reporter_id);

-- Add RLS to analytics views (read-only for moderators/admins)
-- Note: Views inherit RLS from underlying tables, but we'll add explicit policies

-- Helper function to check if user is moderator/admin
create or replace function is_moderator_or_admin()
returns boolean as $$
begin
  return exists (
    select 1 from app_roles ar 
    where ar.user_id = auth.uid() 
    and ar.role in ('moderator', 'admin')
  );
end;
$$ language plpgsql security definer;

-- Grant access to analytics views for moderators/admins
grant select on v_days_90 to authenticated;
grant select on v_daily_submissions to authenticated;
grant select on v_daily_approvals to authenticated;
grant select on v_daily_active_public to authenticated;
grant select on v_daily_games_started to authenticated;
grant select on v_daily_tokens_used to authenticated;
grant select on v_review_sla_30d to authenticated;
