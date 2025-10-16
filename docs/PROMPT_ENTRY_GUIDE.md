# Prompt Entry Guide

This guide walks non-technical teammates through adding or updating prompts in the admin panel. Each section highlights the required values, recommended defaults, and a simple checklist to keep prompt data consistent across the stack.

---

## Quick Start Checklist

1. **Open the Admin Panel**: Navigate to `/admin/prompts` (prompt_admin role required).
2. **Search First**: Use the search box to confirm a similar prompt does not already exist.
3. **Create or Edit**:
   - Click **New Prompt** for a fresh entry, or **Edit** beside an existing row.
4. **Fill Basic Info** (see field reference below):
   - Choose the appropriate `layer`.
   - Add `category` / `subcategory` if you are grouping prompts within the layer.
   - Set `world_slug` / `adventure_slug` only when the prompt is specific to that scope.
   - Set `turn_stage = start` only for adventure-opening content.
5. **Enter Content**:
   - Paste the prompt content in the **Content** tab.
   - Select the `format` (Markdown, JSON, or String) to enable validation tools.
6. **Dependencies** (optional):
   - Add any IDs or slugs this prompt depends on.
7. **Metadata Review**:
   - Toggle **Metadata** → **Show** to confirm the JSON preview contains the category, subcategory, dependencies, and format you expect.
8. **Save Prompt** and confirm success toast.
9. **Refresh Stats**: The dashboard cards update automatically; re-open the prompt list to ensure the new entry appears in the right layer.

---

## Field Reference

| Field | Required? | What to Enter | Notes |
|-------|-----------|---------------|-------|
| **Layer** | Yes | `core`, `world`, `adventure`, `adventure_start`, or `optional` | Determines load order for the assembler. Legacy layers remain selectable for clean-up, but avoid them for new prompts. |
| **Category** | Optional | Short label (e.g. `logic`, `world_npcs`) | Groups prompts inside the layer. Use lowercase letters, numbers, or underscores. |
| **Subcategory** | Optional | More specific grouping (e.g. `villages`, `boss_encounters`) | Helpful when a layer/category combination still has many prompts. |
| **World Slug** | Optional | Lowercase world identifier (e.g. `mystika`) | Leave empty for system-wide prompts. |
| **Adventure Slug** | Optional | Lowercase adventure identifier (e.g. `whispercross`) | Only set when the prompt is tied to a single adventure. |
| **Scene ID** | Optional | In-game scene/step identifier | Leave blank if the prompt applies to all scenes. |
| **Turn Stage** | Yes | `any`, `start`, `ongoing`, or `end` | Use `start` only for prompts that run before the first player turn. |
| **Sort Order** | Yes | Integer (e.g. `10`, `20`, `30`) | Represents the sequence inside the layer/category. Leave gaps (increments of 10) to make later inserts easier. |
| **Version** | Optional | Semantic string (default `1.0.0`) | Autoconverts numbers to strings. |
| **Active** | Yes | Leave checked to include the prompt | Uncheck to remove prompt from assembly without deleting it. |
| **Locked** | Yes | Check to prevent edits | Use when the prompt is reviewed and frozen. |
| **Dependencies** | Optional | Array of prompt IDs or slugs | Managed in the **Dependencies** tab; saved into metadata. |
| **Format Buttons** | Optional | Markdown / JSON / String | Used by the validation helpers, stored in metadata. |

---

## Recommended Categories by Layer

The admin UI includes quick-pick buttons for these values. Use them whenever possible to keep naming consistent.

| Layer | Primary Purpose | Suggested Categories |
|-------|-----------------|----------------------|
| `core` | Global rules and AI guardrails | `logic`, `output_rules`, `npc_agency`, `failsafes` |
| `world` | Lore and mechanics for a specific world | `world_rules`, `world_npcs`, `world_events` |
| `adventure` | Story beats and encounters inside an adventure | `story_beats`, `encounters`, `adventure_npcs` |
| `adventure_start` | Opening payload for new games | `opening_state`, `intro`, `npc_snapshot` |
| `optional` | Experimental or temporary prompts | `playtest`, `legacy`, `debug` |

Feel free to introduce additional categories when needed—just keep them lowercase with underscores and make sure the name clearly communicates the purpose.

---

## Example Workflows

### Adding a World Lore Prompt
1. Click **New Prompt**.
2. Layer: `world`, Category: `world_rules`, Subcategory: `geography`.
3. World Slug: `mystika`; Adventure Slug: leave blank.
4. Turn Stage: `any`; Sort Order: `20`.
5. Paste lore content (Markdown). Set format to **Markdown**, click **Validate**.
6. Add dependencies if the lore references other prompts.
7. Save prompt.

### Updating the Adventure Start Snapshot
1. Filter for Layer `adventure_start` and Adventure Slug `whispercross`.
2. Edit the prompt labelled `opening_state`.
3. Adjust NPC list inside the JSON block.
4. Run **Validate** (JSON), then **Minify** to store compact JSON.
5. Save prompt and confirm the category remains `opening_state`.

---

## Common Pitfalls

- **Uppercase Layer/Category Names**: The system lowercases these values automatically. If you see uppercase in existing entries, edit and re-save to normalise.
- **Missing Sort Order Gaps**: Avoid using sequential numbers (1,2,3). Stick to multiples of 10 so you can insert prompts later without renumbering.
- **Dependencies Not Reflected in Metadata**: Remember that the metadata preview shows the final JSON payload. If dependencies are missing there, double-check the **Dependencies** tab before saving.

Need help? Reach out in `#prompt-authoring` with the prompt ID and what you are trying to add. We'll keep the taxonomy updated as new layers/categories are introduced.
