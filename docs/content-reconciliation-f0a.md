# F0a content reconciliation: full hosted inventory

Audit date: 2026-09-27 (latest retrieval 2026-09-27T20:03:02.264Z UTC)

## Method

This audit supplements the earlier read-only run of `supabase/scripts/export-hosted-base.mjs`, whose filters cover only its export scope. The full inventory used the configured hosted Supabase project `obfadjnywufemhhhcxiy.supabase.co` and issued HTTP `GET` requests only; it made no database changes.

For each content table below, the request was `GET /rest/v1/<table>?select=*`, paged in ranges of 500 rows with `Prefer: count=exact`. The complete unfiltered tables were `chimera_worlds`, `chimera_entities`, `chimera_lore`, and `premade_characters`. Owner-role lookup used `GET /rest/v1/profiles?select=id%2Crole` and `GET /rest/v1/app_roles?select=user_id%2Crole`. Requests included the service key as an API credential but used the GET method only. No response payloads or credentials are stored here.

Approximate content bytes are the UTF-8 size of the JSON row after removing row ID, timestamps, owner IDs, world ID, visibility, and official-status metadata. Rows without a content key/slug are identified by database row ID. `n/a` means the returned row shape has no such field; SQL `NULL` is shown as `null`.

## Full inventory

Counts: 2 worlds, 7 entities, 11 lore rows, 7 premade characters. The only non-null owner is `b5c9906f-63ed-4234-afd8-7a8e5cf12085`, with profile/app roles `admin,moderator`. No non-admin or unclassified owner IDs were found.

| kind | key / slug / row ID | visibility | official | owner | owner role | approx. bytes | related world |
|---|---|---|---|---|---|---:|---|
| world | mystika | public | true | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 2214 | n/a |
| world | test | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 1034 | n/a |
| entity | d-d | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 558 | mystika |
| entity | whispercross_glade | public | true | SQL NULL | n/a | 273 | mystika |
| entity | cael | public | true | SQL NULL | n/a | 285 | mystika |
| entity | kiera | public | true | SQL NULL | n/a | 949 | mystika |
| entity | rillford_square | public | true | SQL NULL | n/a | 259 | mystika |
| entity | slavers | public | true | SQL NULL | n/a | 240 | mystika |
| entity | daakon | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 164 | mystika |
| lore | id:213f50ed-a6e7-4ebb-b7f4-32174abb7c3b; “The Fracture of the White Spire” | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 748 | test |
| lore | id:f4bb34f7-9b02-4902-908e-7454b2e63510; “The Whispering canyon” | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 622 | test |
| lore | id:80d43779-8519-452a-bfd6-ce7d944eb3cc; “The Ironbound Pact” | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 694 | test |
| lore | id:3b78256b-8ee8-406f-afd5-43016369b824; no display title | private | false | SQL NULL | n/a | 269 | test |
| lore | id:43e801bc-bb8c-496b-8719-f43ac55a188a; no display title | private | false | SQL NULL | n/a | 226 | test |
| lore | id:16c1f374-180f-4cc0-b774-4bc9f4fcfc78; no display title | private | false | SQL NULL | n/a | 269 | test |
| lore | id:5c364089-f5e7-4348-b573-dd6cba57e4ee; no display title | private | false | SQL NULL | n/a | 226 | test |
| lore | id:42f75059-64c0-490f-b77c-db3e80bfd337; “The First Fracture” | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 720 | mystika |
| lore | id:abbc0ec5-7459-47d0-81d5-03482b1b127f; “Void Sickness” | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 661 | mystika |
| lore | id:d7c92772-2929-4d56-9823-3e27adde7c28; “The Anchor Compass” | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 611 | mystika |
| lore | id:19d430bc-1f7b-4d6c-b054-7aea530f75f4; “Captured Allies” | private | false | b5c9906f-63ed-4234-afd8-7a8e5cf12085 | admin,moderator | 392 | mystika |

The premade table returned these fields: `archetype_key`, `avatar_url`, `base_traits`, `created_at`, `display_name`, `id`, `is_active`, `summary`, `updated_at`, `world_id`, `world_slug`. It has no visibility, official-status, or owner field in the returned row shape; those values are `n/a`.

| premade key | world_slug | world_id status | approx. bytes | resolution |
|---|---|---|---:|---|
| elven-court-guardian | mystika | stale ID `65103459-9ef0-49bd-a19c-29e73e890ecf` (no matching world row) | 1046 | Keep; resolve to `mystika` key and ignore the stale ID. |
| veil-touched-mage | mystika | stale ID `65103459-9ef0-49bd-a19c-29e73e890ecf` (no matching world row) | 1121 | Keep; resolve to `mystika` key and ignore the stale ID. |
| neural-hacker | aetherium | no world ID | 1088 | Drop: no world row exists. |
| nature-guardian | whispercross | no world ID | 1086 | Drop: no world row exists. |
| superhero-origin | paragon-city | no world ID | 976 | Drop: no world row exists. |
| court-noble | veloria | no world ID | 897 | Drop: no world row exists. |
| shadow-hunter | noctis-veil | no world ID | 932 | Drop: no world row exists. |

Exact world-key check: `veloria` absent; `whispercross` absent; `aetherium` absent; `noctis-veil` absent; `paragon-city` absent. There are 2 worlds total, below the approximately ten-world threshold.

## First-party content selected for the repo catalog

A follow-up read-only payload fetch at 2026-09-27 20:52 UTC repeated `GET /rest/v1/chimera_worlds?select=*`, `chimera_entities?select=*`, and `chimera_lore?select=*`. It used the known admin owner ID and row keys to select sanitized content fields locally; the hosted database was not changed.

- Worlds: `mystika` and private admin-owned `test`.
- Entities: the five checked-in Mystika entities plus admin-owned `d-d` and `daakon` (both relate to `mystika`).
- Lore: the four checked-in Mystika rows plus admin-owned titled rows “The Fracture of the White Spire”, “The Whispering canyon”, and “The Ironbound Pact” on `test`.
- Premades: `elven-court-guardian` and `veil-touched-mage` retain `world_key: mystika`; stale `world_id` values are omitted. The five absent-world premades in the table above are omitted.

These confirmed rows are represented under `content/first-party/` and sync with `release_state: internal`. Legacy database IDs, timestamps, owner fields, and visibility flags are not authored references.

## Inclusion hold

Four private lore rows linked to the private `test` world have SQL `NULL` ownership and no display title: `3b78256b-8ee8-406f-afd5-43016369b824`, `43e801bc-bb8c-496b-8719-f43ac55a188a`, `16c1f374-180f-4cc0-b774-4bc9f4fcfc78`, and `5c364089-f5e7-4348-b573-dd6cba57e4ee`. They remain excluded pending owner confirmation; no hosted content has been written.

## Unresolved legacy AWF graph references

A separate read-only GET check at 2026-09-27 20:47 UTC for `adventures` and `worlds` returned PostgREST `PGRST205` for both relations; neither is exposed by the hosted project. The checked-in `dialogue_graphs` rows reference `world.forest_glade` and `adv.herbal_journey`, and the checked-in `quest_graphs` row references `whispercross` as an adventure. Those keys do not map to any hosted Chimera world row or checked-in adventure source. No placeholder world or adventure was created. These graph rows are held out of the initial first-party bundle until their reference treatment is confirmed.
