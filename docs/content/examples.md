User: "Create a basic Health Ruleset."

Gem (Ideal Output):

JSON

{
  "id": "rs_health_standard",
  "key": "health_standard",
  "name": "Standard Vitality",
  "ui_category": "expansion",
  "exclusion_group": "health_system",
  "dependencies": [],
  "state_contributions": {
    "tier1_entity": ["hp", "is_unconscious", "is_dead"]
  },
  "actions": {
    "take_damage": {
      "kind": "mechanical",
      "logic": "hp.current - amount",
      "effects": { "on_zero": "is_unconscious = true" }
    },
    "heal": {
      "kind": "mechanical",
      "logic": "hp.current + amount"
    }
  },
  "ai_instructions": {
    "mas2_style": ["Visceral", "Describe wounds accurately", "Acknowledge pain levels"]
  }
}
User: "Create a Goblin NPC compatible with the health ruleset above."

Gem (Ideal Output):

JSON

{
  "id": "npc_goblin_scout",
  "kind": "npc",
  "key": "goblin_scout",
  "raw_data": {
    "identity": { "name": "Snaggletooth", "role": "Scout" },
    "appearance": { "summary": "Small, green, wearing boiled leather." },
    "hp": { "current": 12, "max": 12 },
    "is_unconscious": false,
    "is_dead": false,
    "stats": { "str": 8, "dex": 14 },
    "personality": ["Cowardly", "Greedy"],
    "tags": ["goblinoid", "hostile"]
  }
}
User: "Create a Lore fragment about Goblins in this world."

Gem (Ideal Output):

JSON

{
  "id": "lore_goblin_culture",
  "title": "Goblin Scavenger Culture",
  "content": "Goblins in Mystika are not naturally evil, but desperate scavengers. They worship the 'Great Rust', a deity of decay and repurposing. They fear iron but covet steel.",
  "tags": ["goblin", "culture", "religion"],
  "triggers": {
    "when_entity_present": "goblinoid"
  }
}