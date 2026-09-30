# Stonecaster screens

Rendered designs for the whole app, mobile first. PNGs are the reference to build against. `source/` holds the static mockup HTML each PNG was drawn from (with `source/sc.css`); read it for exact spacing and sizes, but do not copy its markup or class names into the app.

All names, numbers and prices are sample data. Never hardcode them. Where a screen and `docs/design/play-redesign/SPEC.md` disagree, SPEC wins (§11 covers the newest decisions).

| Screen | Mobile | Desktop | Phase / spec |
|---|---|---|---|
| Landing | `Landing-Mobile.png` | `Landing.png` | Marketing |
| Sign in / request access | `Access-Mobile.png` | `Access.png` | Auth, early access |
| Stories catalog | `Stories-Mobile.png` | `Stories.png` | Catalog |
| Story detail | `StoryDetail-Mobile.png` | `StoryDetail.png` | Catalog; shows the live per-turn price |
| Choose a character | `Choose-Character-Mobile.png` | `Choose-Character.png` | Start flow |
| Character Forge | `Character-Forge-Mobile.png` | `Character-Forge.png` | Steps come from the world's creation manifest |
| Play | `Play-Mobile.png` | `Play.png`, `Play--slim-rails.png` | Play Phase 0–1, SPEC §11.1–11.2 |
| Play, focus mode | `Play-Mobile-Focus.png` | `Play-Focus.png` | SPEC §11.2 |
| Layout and HUD settings | `HUD-Settings-Mobile.png` | `HUD-Settings.png` | SPEC §11.2 |
| Character panel by ruleset | `Play-Mobile-Character.png` | `Play-Systems.png` | Phase 0 adapter, Phase 6; SPEC §11.3 |
| Here panel | `Play-Mobile-Here.png` | (in `Play.png`) | Phase 0, 4 |
| Action tray | `Play-Mobile-Tray.png` | (top bar menu) | Phase 4 |
| Turn states | `Play-States-Mobile.png` | `Play-States.png` | Phase 1–2 |
| People dossier | `Play-Mobile-Dossier.png` | `Play-Codex.png`, `Play-Codex--relationships-only.png` | Phase 3, SPEC §11.4 |
| Casting Circle, Elements | `Casting-Elements-Mobile.png` | `Casting-Elements.png` | Story creation; missing refs block Bind |
| Casting Circle, Bind | `Casting-Bind-Mobile.png` | `Casting-Bind.png` | Story creation |
| My creations | `My-Creations-Mobile.png` | `My-Creations.png` | F0b tiers, read-only over cap |
| My stories | `My-Stories-Mobile.png` | `My-Stories.png` | Resume |
| Stones and plan | `Stones-Mobile.png` | `Stones.png` | PLAN Phase 1 billing, F0b active choices |
| Admin, Stones and pricing | `Admin-Pricing-Mobile.png` | `Admin-Pricing.png` | PLAN Phase 1 admin |
| Admin, content release | `Admin-Content-Mobile.png` | `Admin-Content.png` | F0b release controls |

Mobile screens are 390px wide. Desktop screens are 1440px wide. App navigation on mobile is a bottom tab bar; play has no tab bar.

The older play boards in `docs/design/play-redesign/boards/` still apply for detail the new screens don't cover (conversation mode, combat, text interactions), except where SPEC §11 overrides them (no Health bar, player-controlled panels).
