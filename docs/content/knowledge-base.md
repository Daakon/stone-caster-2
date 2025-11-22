1. The Runtime Reality (MAS1 vs. MAS2)
MAS1 (The Interpreter): Reads user text and maps it to actions.

Content Rule: Action keys must be distinct verbs (e.g., attack, persuade, travel). Avoid ambiguous keys.

MAS2 (The Narrator): Reads the Engine's math output and lore to write prose.

Content Rule: ai_instructions.mas2_style should contain adjectives and tonal guides (e.g., "lovecraftian", "terse", "sensory-heavy"), not mechanical instructions.

2. The Tier System (The Golden Rule)
Tier 1 (Mechanical): Hard numbers, booleans, and enums (HP, Strength, IsAlive).

Usage: Only accessible by the Engine.

Rule: If a Ruleset logic script calculates it (e.g., d20 + str), it must be Tier 1.

Tier 0 (Narrative): History, personality, visual description, relationships.

Usage: Only accessible by MAS2 (The Narrator).

Rule: Never put math in Tier 0. Never put backstory in Tier 1.

3. The Compiler Filter (The Sanitizer)
Concept: Entities are just bags of data (raw_data). Rulesets are the filters.

Rule: If you put mana: 100 on a Goblin, but the user selects a "No Magic" ruleset, that mana key is deleted at compile time.

Strategy: Content should be "over-stuffed." Give entities stats for multiple systems (D20, D100, etc.), knowing that the Compiler will strip out whatever isn't used.