# Local canonical schema: RLS / privilege changes vs hosted

Source of truth for structure: hosted project `stone-caster-2` (`obfadjnywufemhhhcxiy`), extracted read-only.
Local baseline: `supabase/migrations/20260201*.sql`. **Hosted was not modified.** Nothing below is applied to hosted;
these are the corrections the local canonical baseline makes (and that a future hosted hardening migration should copy).

## 1. Row Level Security is enabled on every table (74/74)

Hosted had RLS **disabled** on 20 tables, so anyone with the public anon key could read/write them:
`app_config, pricing_config, ai_config, feature_flags, config_meta, app_roles, turn_metrics, chimera_content_pack_lore_links,
chimera_content_packs, chimera_story_compiled_ruleset, chimera_story_content_pack_links, chimera_tags,
chimera_content_pack_entity_links, chimera_content_pack_ruleset_links, chimera_pack_dependencies, chimera_asset_tags,
chimera_exclusion_groups, chimera_assets, chimera_compiled_stories, chimera_turns`.

| Table(s) | Local behaviour |
|---|---|
| `app_config`, `pricing_config`, `feature_flags`, `config_meta`, `chimera_exclusion_groups`, `chimera_tags`, `chimera_asset_tags` | public **read**; writes admin / service_role only. Authenticated users may *propose* unapproved tags. |
| `ai_config`, `turn_metrics` | admin / service_role only (hosted: open) |
| `app_roles` | user reads own rows; **no client writes** (hosted: anon could insert/update/delete/truncate → self-promote to admin) |
| `chimera_turns` | owner-only through `chimera_game_states.player_id = auth.uid()` (hosted: open to anon) |
| `chimera_compiled_stories`, `chimera_story_compiled_ruleset`, `chimera_story_*_links` | via owning story (public read of compiled stories only for public stories) |
| `chimera_content_packs` + `chimera_content_pack_*`, `chimera_pack_dependencies` | public packs readable; owner writes |
| `chimera_assets` | public read; owner writes |

## 2. Removed "public full access" policies (ALL for anon+authenticated, `USING (true)`)

Hosted: `chimera_worlds_public_full_access`, `chimera_entities_public_full_access`, `chimera_lore_public_full_access`,
`chimera_ruleset_templates_public_full_access`, `chimera_world_ruleset_link_public_access`, `chimera_game_states_anon_own`
(anon: `USING (true)` on all game states).

Local replacements:
- **Worlds / entities / lore:** read when `visibility = 'public'` OR `is_official` OR owned; writes only by owner (cannot set `is_official`); admin all.
- **Rulesets, world↔ruleset links:** public read; admin write.
- **Game states:** authenticated owner only (`player_id = auth.uid()`). **No anon access.**

## 3. Privilege-escalation paths closed

| Hosted problem | Local fix |
|---|---|
| Any user could `UPDATE profiles SET role='admin'` on their own row (`Users can update own profile`, no column limit) | No self-update policy on `profiles`; column-level `UPDATE` grant limited to privilege columns and gated by the *admin* policy |
| Any user could set their own `user_profiles.role` (`admin`, `prompt_admin`) | `UPDATE` limited to non-privilege columns (`display_name, avatar_url, preferences, ...`); `role` not writable by clients |
| `prompts` admin policy trusted `auth.users.raw_user_meta_data->>'role'` — **user-editable at sign-up** | Removed. Admin = `profiles.role = 'admin'` via `is_admin()` |
| `prompts` readable by every authenticated user (leaks Director/Narrator prompt engineering) | Admin / service_role only |
| `assign_admin_role()`, `assign_moderator_role()`, `remove_user_roles()` are `SECURITY DEFINER` and executable by `anon` via PostgREST RPC | `EXECUTE` revoked from `public, anon, authenticated`; service_role only; `search_path` pinned |
| `access_requests` public INSERT `WITH CHECK (true)` (could self-insert `status='approved'`, `approved_by`, any `user_id`) | Insert allowed only as `pending`, with no approver fields and `user_id` null or own |
| `anon` had `TRUNCATE, TRIGGER, REFERENCES, INSERT, UPDATE, DELETE` on every table | `anon` = `SELECT` only (further limited by RLS); `authenticated` = `SELECT/INSERT/UPDATE/DELETE` (RLS-gated); default privileges revoked so new tables are not auto-exposed |
| `profiles_view` (joins `auth.users`: email, last sign-in) exposed through the API, ignoring RLS | Not granted to `anon`/`authenticated` |

## 3b. Additions needed to keep app features working under tight RLS

| Table | Local policy | Why |
|---|---|---|
| `ai_audit_logs` | owner can `SELECT` rows of their own games; can `UPDATE` only the `turn_id` column of their own rows | `StoriesRepository.linkAuditLogToTurn` runs as the user and silently no-op'd on hosted. Inserts remain service-role only |

## 4. Behaviour intentionally kept

- Owner-scoped policies on `chimera_stories`, `chimera_player_characters`, `chimera_instances_v3`, `media_assets`, `author_*`
  are functionally the same as hosted (rewritten only for consistency, role-scoped `TO authenticated`).
- `service_role` bypasses RLS exactly as on hosted, so backend admin-client code paths are unchanged.
- Read of public catalogs by `anon` (worlds, stories, rulesets, premades, media) is preserved.

## 5. Structural differences from hosted (not RLS)

- Omitted legacy functions that reference tables that don't exist on hosted either (`characters`, `game_saves`, `stone_wallets`,
  `guest_stone_wallets`, `stone_ledger`, `turns`, `liveops_*`, `prompt_segments`): `link_guest_account_to_user`, `merge_cookie_groups`,
  `check_guest_account_data`, `get_guest_*`, `get_or_create_guest_wallet`, `migrate_characters_to_user`, `create_turn_analytics`,
  `ensure_turn_number`, `get_effective_liveops_config`, `down_migration_*`, pack/graph helpers, etc. They already fail on hosted.
- Duplicate indexes on hosted (same columns as a unique constraint or another index) omitted.
- Extensions: only `pgcrypto`, `uuid-ossp`, `vector` (the ones actually used).
- Not seeded: `media_assets` / `media_links` (Cloudflare Images), embeddings (`chimera_lore.embedding` = null).

## 6. Expected follow-ups when the app hits an RLS denial

The backend mixes a service-role client (`supabaseAdmin`) and a per-request anon-key client carrying the user JWT
(`getChimeraSupabaseClient(req)`, ~45 call sites). Hosted only worked for the latter because of the open policies above.
Every denial found while exercising the app is recorded in the "Fix log" in `README.md`.
