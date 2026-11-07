# Screen specs

One section per screen in the 2.0 design canvas. Each has a static reference (`reference/<id>.html`), a screenshot (`screenshots/<id>.png`), and the behaviour the picture cannot show. Routes are proposals; keep the IDs stable even if routes change.

Viewport: every app screen is drawn at **390×844** and must also work at **1100** and **1440** (see "Desktop" under each). Only the landing page is drawn at desktop width.

Names in the mocks (Rowan, Lyra, Tessa, Provost Merin, Emberlight Academy, The Vanished Bond…) are sample content. Never hardcode them. Text in `[brackets]` is an open value (price, Stones amount, creator name).

---

## 1. Landing (`landing`)

- **Route:** `/` (public, crawlable, prerendered or edge-meta; see plan decision 6)
- **Files:** `reference/landing.html`, `screenshots/landing.png` (1440), `screenshots/landing-mobile.png` (390)
- **Job:** get a stranger into a story without signing up.

**Layout, top to bottom**

1. Header: mark + wordmark, nav (Browse, Create, Pricing), Sign in (ghost), **Play free** (primary).
2. Hero, two columns (stacks on phone): overline "AI story worlds", H1 "Your party comes with you.", lede, **Play a story free** + "No signup to start". Right: a live sample card — story cover image, title + mode tag, one paragraph with tappable element names, three choice chips.
3. "Start with one of these": three story cards (one per mode: Story, Light RPG, Full RPG).
4. "How it plays": three numbered steps.
5. Companion hook: two panels, story one → story two, showing a companion following you.
6. "Tap any name": prose with every element type + an open name card (portrait, what you know, Talk to them / More).
7. Creator teaser: one-sentence idea → draft card.
8. Pricing teaser: Free + two paid tiers (placeholders). States uploads are free and generating images costs Stones.
9. Footer: Guides, Content policy, Privacy, Terms.

**Behaviour**

- Tapping a hero chip starts that story as a guest at `pick-character` with the choice queued as the first action after the opening.
- Tapping a name in the hero opens the same name card used in Play (read-only, no "Talk to them").
- Story cards link to `story-page`.
- **Analytics:** `landing_view`, `play_click {source: hero_chip|hero_cta|card}`.

**Acceptance:** no horizontal scroll at 390; LCP image is the hero cover; page has `<title>`, description and `og:image` from server-rendered HTML.

---

## 2. Story page (`story-page`)

- **Route:** `/s/:storySlug` (public, crawlable)
- **Files:** `reference/story-page.html`, `screenshots/story-page.png`
- **Job:** answer "what is this and is it for me?" in one screen, then Play.

**Layout:** full-bleed cover image (248px) with Back and Share over it → tag row (mode, genre, rating, length) → title (Fraunces 32) → lede → world link → "People you'll meet" (portrait 52 + name + one line, max 3) → companion note ("Companions from other {world} stories can come with you") → "How it opens" (first paragraph) → byline → **sticky bottom bar**: Play (52px) + "Free to start. No account needed."

**Data:** story (title, slug, cover, hook, mode, rating, length estimate, opening excerpt, creator, official flag), world (name, slug), featured cast (≤3: name, portrait, teaser line).

**Behaviour:** Play → `pick-character`. If the signed-in player has a character in this world, the sticky bar can read "Play as {name}" and skip straight to Play with a Change link. Share uses Web Share API, falling back to copy-link.

**Analytics:** `story_view`, `play_click {source: story_page}`.

---

## 3. Pick who you are (`pick-character`)

- **Route:** `/s/:storySlug/start`
- **Files:** `reference/pick-character.html`, `screenshots/pick-character.png`
- **Job:** choose a character in one screen; the default must be one tap.

**Sections in order**

1. **Your characters in {world}** (only if any): selected card with portrait 56, name, one line, check mark; below it, companions who will come along, each with **Leave behind**.
2. **Or play as**: up to 3 premade characters for this story.
3. **Make me someone**: inline Name + One line inputs. "The story fills in the rest."

Sticky bottom button: **Begin as {name}**.

**Rules**

- Pre-select: the player's most recent character in this world, else the first premade.
- Companions already in the party are pre-included; leaving one behind is per run, not permanent.
- If the story recommends a template and the chosen character lacks it, show one line: "This story works best with {template}. Apply it?" (Apply / Not now).
- Creating "Make me someone" creates a real character in this world (fields 4–6 generated later).

**Analytics:** `character_picked {kind: existing|premade|new}`.

---

## 4. Play (`play`, `play-namecard-open`)

- **Route:** `/play/:runId`
- **Files:** `reference/play.html`, `reference/play-namecard-open.html`, matching screenshots
- **Job:** read and act. Everything else is one tap away.

**Regions (phone)**

| Region | Contents |
| --- | --- |
| Header (56) | Leave (back), story title + location · time line, party avatars (34, tap → name card), menu |
| Feed | Scene image with caption (when the story or scene has one) → narration (Newsreader 17/1.65) → player turn bubble (right-aligned, raised bg, overline "You · Say") → NPC dialogue (portrait 40 + uppercase name + prose) → **change chips** → Undo / Retry (last turn only) |
| Composer | Suggestion chips (horizontal rail) → Do / Say / Look segmented control → textarea + round send button (48) |
| Name card | Bottom sheet over a scrim: image (72; round for people, rounded-square for places/items/factions, lettered tile if no image), name, role line, close, "What you know" rows with source turn, "N still unknown", **Talk to them** + **More** |

**Element links in prose** (colour **and** underline style, never colour alone):

| Kind | Colour token | Underline |
| --- | --- | --- |
| Character | `sc-ent-npc` | dotted |
| Place | `sc-ent-place` | dashed |
| Item | `sc-ent-item` | solid |
| Lore | `sc-ent-lore` | double |
| Faction | `sc-ent-faction` | wavy |

Element links are real `<button>`s with the element name as accessible name. Only elements the player has encountered are linked; true names of unidentified characters are never shown.

**Turn states:** `idle` → `sending` (player bubble appears immediately) → `thinking` (shows real server phase label) → `streaming` (prose appears) → `committed` (change chips, links and suggestions appear) or `failed` (turn stays, "The scene didn't finish. Nothing was charged and your words are kept." + **Try again**). Never a cancel button.

**Change chips** come only from the committed updates block (see plan, "How story output becomes state"). Tapping a chip opens the relevant card (item → item card, relationship → character card, character change → character page).

**Display levels** (from story mode, overridable in menu):

| Level | Phone adds | 1100 | 1440 |
| --- | --- | --- | --- |
| Story | — | prose centred at 720 measure, no rails | same |
| Story + Party | cast strip under header, objective line, Journal button | slim right rail (avatars) | right rail 328: Here, Party, Journal |
| Full | status card under header (collapsible) | slim rails both sides | left rail 288: character card + status card; right rail as above |

Map these to `PlayShell` / `ThreeColumnLayout` / `SlimRail` / `HereRail` / `CharacterRail` from the implementation plan (P0.6); the status card replaces `CapabilityModuleView` and vitals strips.

**Composer behaviour:** mode defaults to Do; tapping a chip fills and sends it (chips are pre-moded). Textarea grows to 4 lines then scrolls internally (scrollbar hidden). Enter sends on desktop; Shift+Enter is a newline. On phones the composer stays above the keyboard.

**Name card behaviour:** opens on tap of any element link, party avatar, or change chip. *Talk to them* closes the sheet, sets mode to Say and prefills "{Name}, ". *More* opens the full element page/sheet (what you've learned, history, private notes). Escape and scrim tap close; focus returns to the opener.

**Analytics:** `turn_committed {n, mode}`, `turn_failed`, `undo`, `retry`, `namecard_open {kind}`, `companion_recruited`.

---

## 5. Guest save prompt (`guest-save`)

- **Shown in:** Play, as a bottom sheet over the feed
- **Files:** `reference/guest-save.html`, `screenshots/guest-save.png`
- **Trigger:** anonymous user, after committed turn 5 (configurable). Dismissable twice ("Not now", with "You can play {n} more turns before saving."), then required to send another turn.

**Content:** player portrait + the most significant NPC's portrait over ripple rings → title "Save your story so {NPC} remembers you" (fallback: "Save your story") → body names the character, the companion and the starter Stones → Continue with Google / Apple / Use email → Not now.

**Behaviour:** links an identity to the existing anonymous Supabase user (same user ID, nothing to migrate). If the email already belongs to an account, sign in and run the guest-merge step. Starter Stones are granted on identity link, never on anonymous creation.

**Analytics:** `save_prompt_shown {turn}`, `save_prompt_dismissed`, `account_linked {provider}`.

---

## 6. Session recap (`session-recap`)

- **Route:** `/play/:runId/recap` (also shown when returning to a paused run, and in the next-day email)
- **Files:** `reference/session-recap.html`, `screenshots/session-recap.png`

**Layout:** close → cover image → overline "{story} · Session {n}" → headline (one generated line) → three recap lines (prose) → "What changed" chips → "Still open" card (one thread, amber overline) → **Continue this story** → divider → "Take {companion} into a new story": player + companion portraits, one suggested story card in the same world with a "{companion} can come" tag → "More {world} stories".

**Data:** generated recap (3 lines + headline) cached per session; committed changes for the session; one open thread; same-world story suggestions that allow companions.

**Analytics:** `recap_view`, `next_story_click {with_companion}`.

---

## 7. Characters hub (`characters-hub`)

- **Route:** `/characters?world=:worldSlug`
- **Files:** `reference/characters-hub.html`, `screenshots/characters-hub.png`
- **Job:** all of the player's characters, grouped by world.

**Layout:** title → world chip rail (worlds where the player has characters; selected chip uses `chip-on`; last chip "Explore worlds") → character cards → "New character in {world}" dashed card → Templates rail (Blank, saved, shared; "See all") → bottom app nav (Home, Browse, Characters, Create, Account).

**Character card:** portrait 64 (teal ring = player character), name, one line; companions row (overlapping 32px portraits + "Lyra and Tessa in your party"); footer: story count + in-progress story, **Continue** (or **Find a story** if none).

**Behaviour:** the world chip is remembered per viewer. Card tap → `character-page`. Continue → resumes that character's active run. No timeline UI anywhere.

---

## 8. Character page (`character-page`)

- **Route:** `/characters/:characterId`
- **Files:** `reference/character-page.html`, `screenshots/character-page.png`

**Header:** portrait 88 with a camera button (opens the image picker: Upload free / Generate [N] Stones / Gallery free), name, one line, world tag. Overflow menu: Duplicate ("Start fresh"), Archive, Delete (warns that companions and history go with it).

**Tabs:** Profile · Companions · Journey · Notes.

**Profile tab**

1. **From your stories** ("Updated by play"): one card per living entry — kind label (Possession amber, Condition red, Ability teal, Reputation violet, Relationship), text with element links, source "{story} · turn {n}" in mono, edit button. Footer note: "Removing an entry changes what future turns know, not the story already told."
2. **Status card** (only if a template tracks values): label, "From {template} template", value tiles with deltas.
3. **What you wrote** (Edit): Personality and background, Appearance, Custom instructions (mono block, preserves line breaks).

**Companions tab:** each companion — portrait, how they joined (story · turn), how they feel (short phrase, not a meter), In party / Not in party, Invite to party / Leave behind.

**Journey tab:** stories in order, each with three-line recap and its change chips; tap → that session's recap.

**Notes tab:** private player notes; follow the character across stories.

---

## 9. New character (`new-character`)

- **Route:** `/characters/new?world=:worldSlug`
- **Files:** `reference/new-character.html`, `screenshots/new-character.png`

**Layout:** header (close, "New character", world) → portrait 128 → caption ("Generated from {name}'s one line" when generated) → three image buttons, each with its cost under the label: **Upload · Free**, **Regenerate / Generate · [N] Stones**, **Gallery · Free** → Name → One line (helper: "Shown on your character card and in stories.") → Template chips (Blank, saved, shared) + helper → **More detail** (collapsed: Personality and background, Appearance, Custom instructions) → reassurance line → sticky **Create {name}**.

**Rules:** required = name + one line; face is optional at create (lettered tile until set). Generating an image needs a Stones reservation; show the price before the tap and the balance after. Uploads: size/type limits and a content check; failures say what to do.

---

## 10. Quick Create (`quick-create`)

- **Route:** `/create`
- **Files:** `reference/quick-create.html`, `screenshots/quick-create.png`

**Layout:** title "Make a story" + subline → **Your idea** textarea → **World** chips (New world, the player's worlds, public worlds open to contribution) → **Style** segmented control (Story / Light RPG / Full RPG) with a one-line explanation that changes per choice → **Make it playable** → "Your draft" card: cover slot (Generate [N] Stones / Upload Free), generated title + hook, "Elements · {x} of {n} have images" with typed counts (characters, places, factions, lore, items in their entity colours), **Play draft** / **Edit** → helper line → bottom app nav.

**Behaviour:** Make it playable creates a draft and its starter elements, then shows the card; Play draft opens Play in draft mode (Edit + Restart in the header). Style help text: Story "Pure story. No stats or dice unless you add them." · Light RPG "A few checks, written into the story instructions." · Full RPG "Stats and dice from a template you pick or write."

**Analytics:** `draft_created {style, world_kind}`, `draft_played`.

---

## Not drawn yet (build from the plan, same patterns)

Browse, World page, public Character page, Pricing, Home (signed in), Library, Account and Stones, Stones-low sheet, Publish sheet, Guided edit sheet, desktop Play at 1100/1440. Use the components in `COMPONENTS.md`; ask for a design before inventing a new pattern.
