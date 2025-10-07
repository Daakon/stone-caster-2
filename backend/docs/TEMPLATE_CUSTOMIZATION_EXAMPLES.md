# Template System Customization Examples

## Adding a New World File

### 1. Create the World Logic File

Create a new file at `GPT Prompts/Worlds/YourWorld/world-codex.yourworld-logic.json`:

```json
{
  "world": {
    "name": "YourWorld",
    "genre": "fantasy",
    "setting": "A mystical realm of magic and adventure",
    "themes": ["heroism", "mystery", "magic"],
    "rules": {
      "magic_system": "mana-based",
      "combat": "turn-based",
      "difficulty": "medium"
    }
  },
  "mechanics": {
    "skills": ["combat", "magic", "stealth", "persuasion"],
    "attributes": ["strength", "intelligence", "dexterity", "charisma"],
    "currency": "gold coins"
  },
  "npcs": {
    "types": ["merchant", "guard", "wizard", "thief"],
    "behaviors": ["friendly", "neutral", "hostile", "mysterious"]
  }
}
```

### 2. Add to Template

Edit `backend/src/prompting/stone_caster_mvp_webapp_prompt_template_just_add_files.md` and add:

```markdown
### 4) Your Custom World Logic
<<<FILE core/worlds/yourworld/world-codex.yourworld-logic.json
[PASTE THE ENTIRE FILE CONTENTS HERE, UNCHANGED]
>>>
```

### 3. Test the Template

```typescript
const result = await getFileBasedTemplateForWorld('yourworld', context);
console.log('Files loaded:', result.filesLoaded);
```

## Adding Optional Content Files

### 1. Create a Lore File

Create `GPT Prompts/Worlds/YourWorld/world-codex.yourworld-lore.md`:

```markdown
# YourWorld Lore

## History
YourWorld was created by the ancient gods...

## Geography
The realm consists of three main regions...

## Culture
The people of YourWorld value...
```

### 2. Add to Template (Optional Section)

Edit `backend/src/prompting/stone_caster_mvp_webapp_prompt_template_just_add_files.md` and add:

```markdown
### D) Your Custom World Lore
<<<FILE core/worlds/yourworld/world-codex.yourworld-lore.md
[PASTE THE ENTIRE FILE CONTENTS HERE, UNCHANGED]
>>>
```

## Adding Adventure Files

### 1. Create Adventure File

Create `GPT Prompts/Worlds/YourWorld/adventure.yourquest.json`:

```json
{
  "adventure": {
    "name": "The Quest for the Lost Artifact",
    "description": "A dangerous journey to recover an ancient artifact",
    "scenes": [
      {
        "id": "village_start",
        "name": "Starting Village",
        "description": "A peaceful village where the quest begins"
      }
    ],
    "objectives": [
      "Find the ancient map",
      "Navigate the dangerous forest",
      "Defeat the guardian",
      "Retrieve the artifact"
    ]
  }
}
```

### 2. Add to Template

Edit `backend/src/prompting/stone_caster_mvp_webapp_prompt_template_just_add_files.md` and add:

```markdown
### 2) Your Custom Adventure
<<<FILE yourworld/adventure.yourquest.json
[PASTE THE ENTIRE FILE CONTENTS HERE, UNCHANGED]
>>>
```

## Adding Safety/Policy Files

### 1. Create Policy File

Create `GPT Prompts/Core/policy/your-custom-policy.md`:

```markdown
# Custom Content Policy

## Content Guidelines
- No graphic violence
- No explicit content
- Keep language family-friendly

## Character Interactions
- NPCs should be helpful and engaging
- Avoid stereotypes
- Promote positive values
```

### 2. Add to Template

Edit `backend/src/prompting/stone_caster_mvp_webapp_prompt_template_just_add_files.md` and add:

```markdown
### C) Your Custom Policy
<<<FILE core/policy/your-custom-policy.md
[PASTE THE ENTIRE FILE CONTENTS HERE, UNCHANGED]
>>>
```

## Conditional File Inclusion

You can make files conditional by using comments in the template:

```markdown
<!-- Only include this file for specific worlds -->
### Special World Content
<<<FILE core/worlds/specialworld/special-content.json
[PASTE THE ENTIRE FILE CONTENTS HERE, UNCHANGED]
>>>
```

## File Organization Best Practices

1. **Group related files**: Keep world files together, core files together
2. **Use descriptive names**: `world-codex.mystika-logic.json` is better than `world.json`
3. **Version your files**: Consider adding version numbers for major changes
4. **Document your files**: Add comments explaining what each file contains
5. **Test incrementally**: Add one file at a time and test

## Troubleshooting

### File Not Found Errors

If you see `[FILE NOT FOUND: path]` in your prompts:

1. Check the file path in the template
2. Verify the file exists in the expected location
3. Check file permissions
4. Ensure the path is relative to the GPT Prompts directory

### JSON Parsing Errors

If JSON files cause issues:

1. Validate your JSON syntax
2. Remove comments (// or /* */)
3. Ensure proper escaping of special characters
4. Test with a JSON validator

### Template Not Loading

If the template system fails:

1. Check that the template file exists
2. Verify file permissions
3. Check the console for error messages
4. The system will fall back to the legacy template system
