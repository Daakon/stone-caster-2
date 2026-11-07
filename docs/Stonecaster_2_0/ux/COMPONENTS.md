# Component inventory

Components the 2.0 screens are built from. Build each once in `packages/ui` (props-driven, tokens only, no store imports) and compose screens in `apps/web`. Class names in `reference/sc.css` are only the mock's shorthand; do not copy its raw hex values into product code.

| Component | Used on | Props (suggested) | Notes |
| --- | --- | --- | --- |
| `Button` | everywhere | `variant: primary \| secondary \| ghost`, `size: md \| lg`, `icon?`, `cost?` | min height 44 (52 for sticky primary CTAs). `cost` renders a `CostBadge` under or beside the label. |
| `CostBadge` | image buttons, premium model, retry | `stones?: number`, `free?: boolean` | Mono 12. Free = muted text "Free"; paid = teal "{n} Stones". Never hide a cost behind a tap. |
| `Chip` | suggestions, world switcher, templates, filters | `selected?`, `as: button \| link` | Pill, 44 tall. Selected = raised bg + violet border + violet text. |
| `ChipRail` | composer suggestions, world chips, templates | children | Horizontal scroll, no scrollbar, scroll-snap, edge fade mask, bleeds to screen edge (negative margin = gutter). |
| `Segmented` | Do/Say/Look, Style picker | `options`, `value`, `onChange`, `aria-label` | `role="group"`; selected segment violet fill with `sc-on-primary` text. |
| `Tag` | story cards, story page | `tone: neutral \| mode \| companion` | Mode tag teal; "companions can join" violet tint. |
| `Portrait` | cast lists, cards, dialogue, name card, header | `src?`, `name`, `size: 28–128`, `ring: npc \| player \| unknown \| none`, `shape: round \| square` | Real image, `object-fit: cover`. Ring: violet NPC, teal player character, dashed grey unidentified. Fallback = initial on raised bg. Square + rounded for places/items/factions. |
| `PortraitStack` | party rows, recap | `people[]`, `size`, `max` | Overlap −12 to −18px. |
| `StoryCover` | landing, story page, recap, draft | `src?`, `alt`, `height` | Fallback is the ring/disc motif, never a gradient. |
| `StoryCard` | landing, browse, recap suggestion | `story`, `layout: vertical \| horizontal` | Always shows mode, rating, length; cast portraits or a companion tag; Play. |
| `ElementLink` | prose everywhere | `kind: npc \| place \| item \| lore \| faction \| unknown`, `elementId`, `onOpen` | `<button>` styled as inline text; colour + underline style per kind (see DESIGN_RULES). |
| `NameCardSheet` | Play, landing demo | `element`, `facts[]`, `unknownCount`, `actions` | Bottom sheet (phone) / popover (desktop). Focus trap, Esc closes, focus returns. |
| `ChangeChip` | Play feed, recap, journey | `change` | Teal outline pill. Tappable when it maps to a card or page. |
| `TurnBlock` | Play feed | `turn` (narration, player input, dialogue[], changes[], state) | Narration = prose font; dialogue = portrait + uppercase speaker + prose; player bubble right-aligned. |
| `TurnStatus` | Play feed | `phase`, `error?` | Real phase labels; failed state with Try again and preserved input. No cancel. |
| `Composer` | Play | `mode`, `suggestions[]`, `onSend`, `disabled` | ChipRail + Segmented + auto-growing textarea (≤4 lines) + round send button 48. Stays above the phone keyboard. |
| `StatusCard` | Play (Full level), character page | `values[]` (label, value, delta?), `template` | Values come from committed turns only. Not shown if no template tracks values. |
| `LivingEntryCard` | character page | `kind`, `text` (with element links), `source {story, turn}`, `onEdit` | Kind label colour: possession amber, condition red, ability teal, reputation violet. |
| `CharacterCard` | characters hub, pick-character | `character`, `companions[]`, `activeRun?`, `selected?` | Portrait 56–64 with player ring. |
| `ImagePicker` | new character, character page, cover slots, element editor | `value`, `onUpload`, `onGenerate`, `onGallery`, `generateCost` | Three options with `CostBadge`. Generation reserves Stones first; shows the result with Keep / Regenerate. |
| `Sheet` | name card, save prompt, guided edit, image picker | `open`, `onClose`, `title` | Radius 22 top corners, scrim `sc-scrim`, drag handle, `sc-shadow-sheet`. |
| `StickyCTA` | story page, pick-character, new-character | `children`, `note?` | Bottom bar on panel bg with top hairline; 52px primary. |
| `BottomNav` | app screens (not Play) | `active` | Home, Browse, Characters, Create, Account. 56 tall, labels 12/600, icons 22. |
| `AppHeader` | app screens | `title`, `subtitle?`, `back?`, `actions?` | 56 tall, panel bg, hairline bottom. |

## Image slots

Every slot that shows a picture accepts upload (free) or generation (Stones) through `ImagePicker`:

| Slot | Shape and size | Where it appears |
| --- | --- | --- |
| Story cover | 16:9, shown 180–248 tall | Cards, story page, recap, draft card |
| Scene image | 2:1, shown ~176 tall, rounded 14 | Top of a scene in the Play feed, with caption |
| Character portrait (player or NPC) | 1:1, round, 28–128 | Cards, dialogue, party, name card, character page |
| Place / item / faction image | 1:1, rounded-square | Name card, element pages |
| World banner | 16:9 | World page (not drawn yet) |

Missing images fall back to the brand ring/disc motif (covers) or a lettered tile (portraits/elements). Every image has meaningful `alt` text, or `alt=""` when decorative and the name sits beside it.
