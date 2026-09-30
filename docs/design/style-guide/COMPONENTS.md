# Stonecaster components

The component inventory for the whole app. Each entry says when to use it and the rules it must follow. Exact visual values live in `reference-components.css` (a static reference stylesheet; its class names are **not** production class names). Build real components on shadcn primitives in `frontend/src/components/ui` and put app-specific ones under `frontend/src/features/<area>/components`. Colours, type and sizes come only from `docs/design/play-redesign/tokens.css`.

Where to see them: `docs/design/screens/*.png` shows every component in context.

## Actions

### Button

Buttons start and confirm actions; one primary per view.

#### Variants
- `primary`: the one action the view exists for (Begin story, Send, Bind fate, Publish). Violet fill `sc-primary`, text `sc-on-primary`.
- `secondary`: alternatives beside a primary. `sc-bg-card` fill, `sc-border-strong` edge.
- `ghost`: dismissals and low-weight actions (Cancel, Back).
- `danger`: destructive actions. Outline by default; the confirming button inside a delete dialog uses `danger solid`.
- `iconbtn`: icon-only, always 44px square with an `aria-label`. `send` is the round violet composer button; it stays disabled until the draft has text.

#### Rules
- Minimum height is `sc-tap` (44px); `sm` (36px) only inside dense rows where a 44px row target already exists.
- Label with the verb that happens: "Begin story", "Bind fate", "Try again". Never "OK" or "Submit".
- No cancel button on a running turn. The turn card offers Try again only after a failure.
- Consumer provides: label text or icon plus `aria-label`, and the click handler.

### Chip

Chips are one-tap suggestions, macros, filters and tags.

#### Kinds
- Suggestion (`chip`): "Continue with" options from the Director. A single click or tap **drafts** the text into the composer. It never sends. There is no double-click commit.
- Macro (`chip macro`): Observe, Rest, Wait under the composer. Show a macro only when the active ruleset supports that action.
- Filter (`chip filter` with `aria-pressed`): catalog filters (genre, ruleset, length).
- Tactic (`chip tactic`): suggestion chips in combat; red edge because combat owns red.
- Tag (`chip tag`): read-only scene or story tags. Not interactive, 28px tall.

#### Rules
- Icons use `sc-primary-soft`; labels use `sc-text`. Keep labels under about 32 characters.
- On mobile the chip row scrolls horizontally and hides while the keyboard is open.

### SegmentedControl

A segmented control switches between two to four exclusive modes.

Used for the composer's Do / Say / Look mode, reader settings (Highlights Off / Key names / All) and ledger filters. The mode is a typed hint sent with the turn; the Director stays authoritative.

- The selected segment is a violet fill with `sc-on-primary` text.
- Each segment is a real button with `aria-pressed`; the group has an `aria-label`.
- Use Tabs, not this, when the choice swaps whole panels of content.

## Forms

### Field

Fields collect text, numbers and choices with a visible label.

- Label above the control (`sc-text-soft`, 13px semibold). Never rely on placeholder as the label.
- Helper text in `sc-text-muted` under the control; errors replace it in `sc-danger-soft` and say how to fix the problem.
- Inputs are 44px tall, `sc-bg-card` fill, `sc-border-strong` edge, `sc-radius-control`.
- Switches are for settings that apply immediately (Show tips, Reduced motion). Use a checkbox inside forms that save on submit.
- Consumer provides: `id` and matching `label for`, value, validation message.

## Navigation

### Tabs

Tabs switch between sibling panels of one object.

Used in the dossier (Known / History / Rumors), Character sheet, Codex, My Creations and admin editors.

- Selected tab: `sc-text` label with a 2px `sc-primary` underline. Others `sc-text-muted`.
- Optional count in mono after the label.
- Tabs scroll horizontally on narrow screens rather than wrapping.
- Built on the shadcn `tabs` primitive for keyboard arrows and roles.

### GlobalHeader

The app header carries the brand, the four destinations, the Stones balance and the account.

- Destinations: Stories (catalog), Worlds, My Stories (resume), Create (Casting Circle and My Creations). Admin appears only for admins, as a trailing link.
- The Stones pill is always visible when signed in; it opens the Stones page. It turns `warn` when the balance cannot cover one turn.
- Height `sc-header-h`, `sc-bg-panel`, hairline below. On mobile the nav moves into a drawer behind the menu button.
- The play screen replaces this header with its own top bar (back, title and save state, location, Journal, search, menu).

### Stepper

The stepper shows position in a sequential flow: Casting Circle (World, Forces, Elements, Lore, Narrative, Bind) and Character Forge (steps from the story's creation manifest).

- Numbers are real order, so they stay. Done steps get a teal ring; the current step a violet fill and `aria-current="step"`.
- Steps are links when revisiting is allowed. The draft autosaves; show Saved / Saving… beside the stepper, not in a toast.

## Feedback

### StatusPill

Pills state a status in one or two words.

| Pill | Meaning |
|---|---|
| `ok` | Healthy or positive: Saved, Compiled, Friendly, Funded. |
| `brand` | Published first-party or featured content. |
| `warn` | Needs attention but works: Internal (admin-only), Read-only over tier cap, Starter grant pending. |
| `bad` | Failed: compile failed, turn failed, missing content. |
| default | Neutral: Draft, Abandoned. |

Always pair colour with the word. The dot is optional and marks live state (Saved).

### Notice

Notices explain a condition the player or creator must know about, inline with the work.

- `warn`: recoverable state (unfunded account, read-only over tier cap, internal content).
- `bad`: something blocks progress (missing references block compile).
- `info`: neutral guidance.
- Title says what happened in plain words; body says what to do next. No apologies, no error codes in player copy.
- Toasts are only for confirming a completed action ("Published"). Anything that needs a decision is a Notice or a Dialog.

### EmptyState

An empty state names what will appear and how to add the first one.

- Title in the display face, one sentence of explanation, one primary action.
- Dashed `sc-border-strong` edge on `sc-bg-panel` so it reads as a slot, not content.
- In play, empty modules are minimal lines instead ("No one else is here"), never a big panel.

## Surfaces

### Card

Cards group one object's content on a surface.

- `card`: default object card on the page or a rail.
- `card panel`: nested inside a card-coloured area, one step darker.
- `card raised`: floats above content (peek, menus). The only card with a shadow.
- Radius `sc-radius-card`, 16px padding, 1px `sc-border` hairline. No coloured left-border accents.

### Sheet

Bottom sheets hold everything on mobile that is not the story or the composer.

- Here (about 78% height), Dossier (85%), Character, action tray. Top corners `sc-radius-sheet`, grab handle, `sc-shadow-sheet`, `sc-scrim` behind.
- Focus moves into the sheet and returns to the trigger on close. Swipe down or the close button dismisses.
- Destructive items sit last and open a confirm dialog.

### ConfirmDialog

Confirm dialogs stop before an irreversible action.

- Title asks the question with the object's name. Body says exactly what goes and what stays.
- The safe button is on the left and named for the outcome ("Keep game"). The destructive button repeats the verb.
- Real deletes (saved game, story, world) require typing a word. Abandon is a soft status and uses a plain confirm.

## Catalog

### StoryCard

A story card sells one story in the catalog or resumes one in My Stories.

- Cover art (16:9) or, until art exists, a generated block composition from brand tokens. Never a stock gradient.
- Overline: world and genre. Title in the display face. Blurb two lines max.
- Meta: the story profile (Chimera core, Cozy, d20…), estimated length, themes. In My Stories: turn and last played.
- Footer: the per-turn Stones cost from the live price (never a hardcoded number) and one action (Begin / Continue).
- Status pill top-left: Featured, In progress, Read-only.

## Account

### StonesBalance

Stones are the turn currency; this shows what a player can spend.

- Available is the headline number; Reserved shows a hold on a running turn; Next turn is the live quoted price, read from the server, never a constant.
- "About N turns" divides available by the current quote and rounds down.
- Pill form in the header. It turns `warn` when available is below one quote.
- A pending starter grant is its own state with its own copy. Do not show it as a zero balance or an error.

### UsageMeter

Usage meters show counts against tier caps for owned stories and saved games.

- Numbers first (`4 / 5`), bar second. At the cap the bar turns `sc-warn`, never red: nothing is lost.
- Over the cap after a downgrade, items outside the active set are read-only. Link to the active-item picker; never imply deletion.

## Play · Text

### EntityLink

Entity links make names in the prose interactive; each kind has its own colour **and** underline shape.

| Kind | Token | Underline | Opens |
|---|---|---|---|
| Character | `sc-ent-npc` | dotted | Peek, then dossier |
| Unidentified | `sc-ent-unknown` | dotted grey | Peek with only what is known, under the seen alias |
| Place | `sc-ent-place` | dashed | Peek with exits and who is present |
| Object | `sc-ent-item` | solid | Peek with Examine / Take / Use if the ruleset allows |
| Lore term | `sc-ent-lore` | double | Glossary card with source |
| Faction | `sc-ent-faction` | wavy | Standing and known members |

- Links are buttons rendered from server-validated runs. The client never regex-links prose.
- Link the first mention per paragraph only; honour the reader's Off / Key names / All setting.
- A small teal dot (`.new`) marks a name the player has not opened yet.
- Never show a true name the player has not learned.

### MechanicsChip

Mechanics chips are the Engine's receipt for a turn, in mono.

- One chip per resolved check or applied delta, in the order the Engine applied them. Collapsed by default; expanding shows the resolution ladder.
- Outcome word coloured by tier: Success `sc-accent-soft`, Partial `sc-warn-soft`, Failure `sc-danger-soft`.
- Built from the persisted Engine result. Never parse numbers out of narration. No chips on a turn with no check.

### NarrativeBlocks

Narration is a list of typed blocks, rendered from the server's presentation, never a raw string.

- `turn-div`: turn number and time band, uppercase 12px.
- Player turn: right-aligned `sc-bg-raised` bubble labelled You do / You say / You look in `sc-primary-soft`.
- Narration: `sc-prose` (19/1.7 desktop, 17/1.65 mobile), `sc-measure` wide.
- Dialogue: speaker uppercase 12px in `sc-primary-soft`, tone note italic muted.
- Voice: skill voice card with the check in the header and an inset teal edge.
- Learned: dashed teal row linking to the dossier. Only committed, validated facts become Learned lines.

## Play · Input

### Composer

The composer is the one input for every turn.

- Desktop: Do / Say / Look segmented control, hint line, multi-line field, macro chips, round send. Send stays disabled until there is text.
- Mobile: pill with a "+" (action tray), inline mode chip, field, send. Chips sit above it and hide while the keyboard is open.
- `/` opens the command palette: /journal, /lore, /status, /who open their real surfaces.
- While a turn runs the composer is disabled and the draft is kept. After a failure the draft is restored beside Try again.

### TurnProgress

The turn progress card shows the three real phases of a running turn.

- Phases map to Director (Reading the room), Engine (Resolving your action) and Narrator (Writing the scene). A phase is marked done only when the server says so. No fake timer.
- No cancel button. The card is identical on every device that opens the game mid-turn.
- Failure replaces the card with a red-edged error card: what happened, that nothing was charged, Try again and Edit. Never partial prose.

## Play · HUD

### Vitals

Vitals and pillars show the character's state with numbers and bars together.

- Only render fields the story's rulesets declare. No default 100s; an absent field is absent.
- Health `sc-danger`, stamina `sc-stamina`, satiety `sc-accent`. Numbers `current / max` with tabular figures.
- A delta chip (`−10`, `+2`) appears beside the label for the turn that changed it.
- Critical thresholds come from the manifest, then the bar undocks into the floating critical bar on mobile.

### HereRail

The Here rail keeps the world visible: scene, time band, and who is present.

- Scene card: place name, known tags, time band as six dots. Show only fields the session provides; never "Unknown".
- Present: cast cards (48px avatar, name or alias, role, disposition, count known). Empty: "No one else is here".
- 328px at 1440; a slim avatar rail at 1100 that expands on click; a bottom sheet on mobile.

## Play · Inspect

### PeekCard

A peek is a small card that previews an entity without leaving the story.

- Opens on hover after 200ms (desktop), tap (mobile), Enter/Space (keyboard). Right-click or long-press opens the verb menu instead.
- Shows only learned facts: name or seen alias, role, disposition, one fact, then Speak to and Dossier.
- Unidentified characters use the dashed grey avatar and their alias.

## Admin

### DataTable

Tables list records for ledgers, admin content and deploy history.

- Header row in overline style; numbers right-aligned in mono with tabular figures.
- Row types as pills. Immutable ledgers show no edit controls; admin credits show the actor and reason.
- Wrap wide tables in their own horizontal scroll container on mobile.
