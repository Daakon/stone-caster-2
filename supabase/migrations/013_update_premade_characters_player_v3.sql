-- Update existing premade characters to use PlayerV3 format
-- This migration updates the base_traits JSONB field to include all PlayerV3 fields

-- Update Mystika premade characters
UPDATE premade_characters 
SET base_traits = '{
  "race": "Crystalborn",
  "class": "veil_touched_mage",
  "essence": ["Life", "Order"],
  "age": "Young Adult",
  "build": "Slender",
  "eyes": "Crystalline Blue",
  "traits": ["Mystical", "Intuitive", "Otherworldly", "Wise"],
  "backstory": "A young Crystalborn who awakened during a devastating Veil-storm. Her crystalline powers allow her to see through the Veil and commune with otherworldly entities.",
  "motivation": "To understand the true nature of the Veil and protect others from its dangers",
  "inventory": ["Crystal Focus", "Veil-sight Goggles", "Ancient Tome", "Healing Potion"],
  "goals": {
    "short_term": ["Master basic Veil-sight", "Find a mentor"],
    "long_term": ["Become a Veil Master", "Protect the realm from Veil-storms"]
  },
  "skills": {
    "combat": 65,
    "stealth": 50,
    "social": 60,
    "lore": 70,
    "survival": 55,
    "medicine": 60,
    "craft": 50
  }
}'::jsonb
WHERE world_slug = 'mystika' AND archetype_key = 'veil-touched-mage';

UPDATE premade_characters 
SET base_traits = '{
  "race": "Elf",
  "class": "shifter_warden",
  "essence": ["Order", "Life"],
  "age": "Adult",
  "build": "Athletic",
  "eyes": "Forest Green",
  "traits": ["Noble", "Protective", "Traditional", "Honorable"],
  "backstory": "A proud member of the Elven Courts who has sworn to protect the ancient traditions from the chaos of Veil-storms and Crystalborn influence.",
  "motivation": "To preserve the ancient ways and protect the realm from corruption",
  "inventory": ["Elven Longsword", "Court Armor", "Ancient Scroll", "Healing Herbs"],
  "goals": {
    "short_term": ["Master court protocols", "Strengthen elven magic"],
    "long_term": ["Become a Court Guardian", "Restore balance to the realm"]
  },
  "skills": {
    "combat": 70,
    "stealth": 75,
    "social": 70,
    "lore": 65,
    "survival": 60,
    "medicine": 55,
    "craft": 60
  }
}'::jsonb
WHERE world_slug = 'mystika' AND archetype_key = 'elven-court-guardian';

-- Update Aetherium premade characters
UPDATE premade_characters 
SET base_traits = '{
  "race": "Human",
  "class": "neural_hacker",
  "essence": ["Data", "Network"],
  "age": "Young Adult",
  "build": "Lean",
  "eyes": "Cyber Blue",
  "traits": ["Analytical", "Rebellious", "Tech-Savvy", "Independent"],
  "backstory": "A legendary underground hacker who has mastered the art of neural manipulation. Known for their ability to navigate the Aetherium network like no other.",
  "motivation": "To expose corporate corruption and free the digital realm from corporate control",
  "inventory": ["Neural Interface", "Data Core", "Hacking Tools", "Energy Drink"],
  "goals": {
    "short_term": ["Hack corporate systems", "Build underground network"],
    "long_term": ["Overthrow corporate control", "Create free digital society"]
  },
  "skills": {
    "combat": 40,
    "stealth": 70,
    "social": 55,
    "lore": 80,
    "survival": 50,
    "medicine": 60,
    "craft": 45
  }
}'::jsonb
WHERE world_slug = 'aetherium' AND archetype_key = 'neural-hacker';

-- Update Whispercross premade characters
UPDATE premade_characters 
SET base_traits = '{
  "race": "Human",
  "class": "nature_guardian",
  "essence": ["Nature", "Harmony"],
  "age": "Adult",
  "build": "Graceful",
  "eyes": "Forest Green",
  "traits": ["Gentle", "Wise", "Nature-Connected", "Peaceful"],
  "backstory": "A gentle soul who has lived in Whispercross Glade for years, learning to listen to the ancient whispers of nature and protect the sacred groves.",
  "motivation": "To protect the natural world and maintain the balance between civilization and nature",
  "inventory": ["Nature Staff", "Healing Herbs", "Ancient Seeds", "Whisper Stone"],
  "goals": {
    "short_term": ["Learn deeper nature magic", "Protect local groves"],
    "long_term": ["Become a Nature Guardian", "Restore balance to the world"]
  },
  "skills": {
    "combat": 50,
    "stealth": 55,
    "social": 65,
    "lore": 60,
    "survival": 60,
    "medicine": 70,
    "craft": 70
  }
}'::jsonb
WHERE world_slug = 'whispercross' AND archetype_key = 'nature-guardian';

-- Update Paragon City premade characters
UPDATE premade_characters 
SET base_traits = '{
  "race": "Human",
  "class": "superhero_origin",
  "essence": ["Justice", "Power"],
  "age": "Young Adult",
  "build": "Athletic",
  "eyes": "Determined Blue",
  "traits": ["Heroic", "Determined", "Idealistic", "Brave"],
  "backstory": "A newly awakened superhuman discovering their incredible abilities in the bustling metropolis of Paragon City.",
  "motivation": "To protect the innocent and fight for justice in the city",
  "inventory": ["Hero Costume", "Communication Device", "First Aid Kit", "City Map"],
  "goals": {
    "short_term": ["Master basic powers", "Find a mentor"],
    "long_term": ["Become a legendary hero", "Protect the city from evil"]
  },
  "skills": {
    "combat": 60,
    "stealth": 65,
    "social": 60,
    "lore": 55,
    "survival": 70,
    "medicine": 50,
    "craft": 0
  }
}'::jsonb
WHERE world_slug = 'paragon-city' AND archetype_key = 'superhero-origin';

-- Update Veloria premade characters
UPDATE premade_characters 
SET base_traits = '{
  "race": "Human",
  "class": "court_noble",
  "essence": ["Nobility", "Diplomacy"],
  "age": "Adult",
  "build": "Elegant",
  "eyes": "Royal Blue",
  "traits": ["Diplomatic", "Elegant", "Strategic", "Noble"],
  "backstory": "A noble of the Velorian court, skilled in political intrigue and courtly manners.",
  "motivation": "To maintain peace and prosperity in the realm through diplomacy",
  "inventory": ["Noble Gown", "Diplomatic Papers", "Royal Seal", "Court Jewelry"],
  "goals": {
    "short_term": ["Master court politics", "Build alliances"],
    "long_term": ["Become a court advisor", "Ensure realm stability"]
  },
  "skills": {
    "combat": 40,
    "stealth": 45,
    "social": 80,
    "lore": 75,
    "survival": 50,
    "medicine": 60,
    "craft": 70
  }
}'::jsonb
WHERE world_slug = 'veloria' AND archetype_key = 'court-noble';

-- Update Noctis Veil premade characters
UPDATE premade_characters 
SET base_traits = '{
  "race": "Human",
  "class": "shadow_hunter",
  "essence": ["Shadow", "Hunting"],
  "age": "Adult",
  "build": "Agile",
  "eyes": "Shadow Gray",
  "traits": ["Focused", "Mysterious", "Determined", "Stealthy"],
  "backstory": "A skilled hunter who tracks dangerous creatures in the shadow realm of Noctis Veil.",
  "motivation": "To protect the realm from shadow creatures and maintain the balance",
  "inventory": ["Shadow Blade", "Hunting Gear", "Shadow Cloak", "Tracking Tools"],
  "goals": {
    "short_term": ["Master shadow hunting", "Track dangerous creatures"],
    "long_term": ["Become a master hunter", "Protect the realm from shadows"]
  },
  "skills": {
    "combat": 70,
    "stealth": 80,
    "social": 50,
    "lore": 60,
    "survival": 75,
    "medicine": 65,
    "craft": 55
  }
}'::jsonb
WHERE world_slug = 'noctis-veil' AND archetype_key = 'shadow-hunter';