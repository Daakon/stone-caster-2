# Segment Scopes – Author Guide

## Overview

Prompt segments are the building blocks of AI-generated content in Stone Caster. Each segment belongs to a specific scope that determines when and where it appears in the final prompt.

## Authored Scopes

These are the scopes you can create and edit in the Prompt Segments admin:

### **Core** 
- **Purpose**: System-wide prelude, always included
- **Reference**: None required
- **Use Case**: Global instructions, system behavior, universal rules
- **Example**: "You are a helpful AI assistant for a tabletop RPG game..."

### **Ruleset**
- **Purpose**: Mechanics or guidance for a specific ruleset
- **Reference**: Must select a Ruleset
- **Use Case**: D&D 5e rules, Pathfinder mechanics, custom game systems
- **Example**: "Follow D&D 5th Edition rules. Use standard ability scores and spellcasting mechanics."

### **World**
- **Purpose**: Lore + invariants for a world
- **Reference**: Must select a World
- **Use Case**: Setting description, world rules, atmosphere
- **Example**: "You are in a magical fantasy realm filled with dragons and wizards..."

### **Entry**
- **Purpose**: Scenario-specific context (adventure/scenario/sandbox)
- **Reference**: Must select an Entry
- **Use Case**: Adventure setup, scenario details, specific quest context
- **Example**: "The party has been hired to investigate mysterious disappearances in the village..."

### **Entry Start**
- **Purpose**: One-time intro for first turn only
- **Reference**: Must select an Entry
- **Use Case**: Initial scene setting, first impression, opening narrative
- **Example**: "As you step into the tavern, the air is thick with smoke and the sound of raucous laughter..."

### **NPC**
- **Purpose**: Character profile with tiered reveals
- **Reference**: Must select an NPC
- **Use Case**: Character descriptions, personality, backstory, secrets
- **Example**: "Gandalf is a wise wizard with a twinkle in his eye and a staff that glows with inner light..."

## System-Generated Scopes

These are **not authored** - they're built automatically at runtime:

- **game_state** – Current game state information
- **player** – Player-specific information  
- **rng** – Random number generation context
- **input** – Input processing context

## Assembly Order

Segments are assembled in this order:

1. **Core** (system-wide)
2. **Ruleset** (in configured order)
3. **World** (world context)
4. **Entry** (scenario context)
5. **Entry Start** (first turn only)
6. **NPC** (character context)
7. **System-Generated** (runtime layers)

## Best Practices

### Content Guidelines
- **Be Concise**: Prefer clear, declarative instructions
- **Avoid Repetition**: Don't repeat content across scopes
- **Use Names + Slugs**: Reference entities by their display names
- **Test with Debug**: Use the debug panel to verify assembly

### Scope Selection
- **Core**: Only for truly universal content
- **Ruleset**: For mechanics that apply to specific game systems
- **World**: For setting and atmosphere that applies to all content in a world
- **Entry**: For scenario-specific context
- **Entry Start**: For first-turn-only introductions
- **NPC**: For character-specific content

### Reference Management
- **Always Use Names**: Select references by their display names, not IDs
- **Verify Targets**: Ensure your reference targets exist and are active
- **Test Associations**: Verify that your segments appear in the right contexts

## Debug and Testing

### Debug Panel
- **Authored Content**: Shows green "Authored" badge
- **System-Generated**: Shows blue "System-Generated" badge
- **Assembly Order**: Shows the order in which segments are assembled
- **Token Count**: Shows estimated token usage for each segment

### Testing Workflow
1. **Create Segments**: Add content for each scope you need
2. **Set References**: Ensure all references point to valid entities
3. **Test Assembly**: Use the debug panel to verify the final prompt
4. **Check Order**: Ensure segments appear in the expected order
5. **Verify Content**: Confirm that system-generated layers are clearly marked

## Common Patterns

### Adventure Setup
```
Core: "You are a helpful AI assistant for tabletop RPGs..."
Ruleset: "Follow D&D 5th Edition rules..."
World: "You are in the Forgotten Realms, a world of magic and adventure..."
Entry: "The party has been hired to investigate a mysterious dungeon..."
Entry Start: "As you approach the dungeon entrance, you notice..."
NPC: "The quest giver is a nervous halfling named Bilbo..."
```

### Character Focus
```
Core: "You are a helpful AI assistant for tabletop RPGs..."
Ruleset: "Follow D&D 5th Edition rules..."
World: "You are in a fantasy realm..."
Entry: "The party is meeting with a local merchant..."
NPC: "The merchant is a shrewd dwarf named Thorin..."
```

## Troubleshooting

### Common Issues
- **Missing References**: Ensure all non-core segments have valid references
- **Wrong Scope**: Use the most specific scope that applies
- **Duplicate Content**: Avoid repeating information across scopes
- **Assembly Order**: Check that segments appear in the expected order

### Getting Help
- **Debug Panel**: Use the debug panel to see exactly how segments are assembled
- **Reference Validation**: The system will warn you if references are invalid
- **Scope Descriptions**: Each scope has helpful descriptions in the admin interface
- **Test Frequently**: Use the debug panel to verify your content works as expected

## Tips for Success

1. **Start with Core**: Begin with universal content in the Core scope
2. **Build Upward**: Add more specific content in Ruleset, World, Entry scopes
3. **Use Entry Start Sparingly**: Only for content that should appear once
4. **NPC Details**: Use NPC scope for character-specific information
5. **Test Everything**: Always use the debug panel to verify your work
6. **Keep It Simple**: Prefer clear, concise instructions over complex rules
7. **Reference by Name**: Always select references by their display names
8. **Verify Assembly**: Check that your segments appear in the expected order
