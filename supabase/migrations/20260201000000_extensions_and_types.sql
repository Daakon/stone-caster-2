-- StoneCaster canonical local baseline (1/6): extensions and enum types.
-- Source: structure extracted read-only from hosted project stone-caster-2 (obfadjnywufemhhhcxiy).
-- This baseline supersedes backend/supabase/migrations/*, whose effects hosted already contains.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector with schema public;

-- Hosted DDL references gen_random_uuid()/uuid_generate_v4()/digest() unqualified.
alter database postgres set search_path to public, extensions;
set search_path to public, extensions;

create type public.avatar_image_status as enum ('none', 'pending', 'approved', 'rejected');
create type public.chimera_entity_type as enum ('NPC', 'ITEM', 'FACTION', 'PlayerCharacter', 'LOCATION');
create type public.chimera_pack_type as enum ('NPC', 'ITEM', 'LORE', 'MIXED');
create type public.chimera_rule_type as enum ('MAIN_SYSTEM', 'SUBSYSTEM', 'MODIFIER');
create type public.chimera_world_visibility as enum ('private', 'pending_approval', 'public');
create type public.entity_kind_enum as enum ('npc', 'item', 'location', 'faction', 'creature');
create type public.liveops_audit_action as enum ('create', 'update', 'activate', 'archive', 'rollback');
create type public.liveops_config_scope as enum ('global', 'world', 'adventure', 'experiment', 'session');
create type public.liveops_config_status as enum ('draft', 'scheduled', 'active', 'archived');
create type public.review_state_enum as enum ('draft', 'pending_review', 'approved', 'rejected');
create type public.ui_category_enum as enum ('foundation', 'expansion', 'flavor');
create type public.visibility_enum as enum ('private', 'pending_approval', 'public');
create type public.visibility_state as enum ('private', 'public', 'unlisted');
create type public.visibility_status as enum ('private', 'pending', 'public');
