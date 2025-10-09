# Stone Caster Template System Guide

## Overview

The Stone Caster template system uses a "just-add-files" approach that simplifies prompt creation and maintenance. Instead of complex template engines, the system uses a single markdown template file with placeholders that get replaced with actual file contents.

## How It Works

### 1. Template File

The main template file is located at:
```
backend/src/prompting/stone_caster_mvp_webapp_prompt_template_just_add_files.md
```

This file contains:
- **System instructions** (static content)
- **Variable placeholders** like `{{turn}}`, `{{scene_id}}`, etc.
- **File placeholders** like `<<<FILE path/to/file.json>>>`

### 2. Variable Replacement

The system replaces these variables with actual game context:
- `{{turn}}` → Current turn number
- `{{scene_id}}` → Current scene ID
- `{{phase}}` → Current scene phase
- `{{time_block_json}}` → Time information as JSON
- `{{weather_json}}` → Weather information as JSON
- `{{player_min_json}}` → Player character data as JSON
- `{{party_min_json}}` → Party members as JSON
- `{{flags_json}}` → Game flags as JSON
- `{{last_outcome_min_json}}` → Last action outcome as JSON

### 3. File Inclusion

The system automatically includes files referenced in the template:
- **Required files**: Core world logic, adventure bundles, safety policies
- **Optional files**: World lore, UI style hints, romance policies

Files are included verbatim - no parsing or modification (except JSON minimization for size).

## Usage

### In Code

```typescript
import { getFileBasedTemplateForWorld } from '../prompting/templateRegistry.js';

const context = {
  turn: 1,
  scene_id: 'forest_meet',
  phase: 'start',
  time_block_json: JSON.stringify({ hour: 12, day: 1, season: 'spring' }),
  weather_json: JSON.stringify({ condition: 'clear', temperature: 'mild' }),
  player_min_json: JSON.stringify({ id: 'player1', name: 'Hero', race: 'Human' }),
  party_min_json: JSON.stringify([]),
  flags_json: JSON.stringify({}),
  last_outcome_min_json: JSON.stringify(null)
};

const result = await getFileBasedTemplateForWorld('mystika', context);
console.log(result.prompt); // The final assembled prompt
```

### Adding/Removing Files

To add a new file to the template:

1. Edit `backend/src/prompting/stone_caster_mvp_webapp_prompt_template_just_add_files.md`
2. Add a new section with a file placeholder:
   ```markdown
   ### New Section
   <<<FILE path/to/new-file.json
   [PASTE THE ENTIRE FILE CONTENTS HERE, UNCHANGED]
   >>>
   ```
3. The system will automatically include the file when the template is processed

To remove a file:
1. Simply delete or comment out the file placeholder section in the template

## File Organization

### Core Files (Required)
- `core/worlds/{world}/world-codex.{world}-logic.json` - World rules and mechanics
- `{adventure}/adventure.{adventure}.json` - Adventure/scenario data
- `core/engine/agency.presence-and-guardrails.json` - AI behavior guidelines

### Optional Files
- `core/worlds/{world}/world-codex.{world}-lore.md` - World background and lore
- `core/style/style.ui-global.json` - UI and presentation hints
- `core/policy/romance-safety-policy.md` - Content safety policies

## Benefits

1. **Simplicity**: No complex template engines or parsing
2. **Transparency**: Easy to see exactly what files are included
3. **Maintainability**: Add/remove files by editing the template
4. **Flexibility**: Can easily add optional files for different scenarios
5. **Debugging**: Clear error messages when files are missing

## Error Handling

- **Missing files**: Replaced with `[FILE NOT FOUND: path]` placeholders
- **Invalid JSON**: Original content preserved with warning
- **Template errors**: Fallback to legacy template system

## Migration from Legacy System

The new system runs alongside the legacy template registry system. The prompts service automatically tries the new system first and falls back to the legacy system if there are any errors.

To fully migrate:
1. Ensure all required files exist in the expected locations
2. Test the new system with your world files
3. Remove the legacy system once you're confident everything works

## Testing

Run the template system tests:
```bash
cd backend
npm test -- file-based-template.test.ts
```

The tests verify:
- Template file loading
- Variable replacement
- File inclusion
- Error handling for missing files