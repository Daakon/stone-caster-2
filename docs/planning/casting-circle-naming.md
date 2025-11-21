✅ Corrected StoneCaster Branding Snapshot (Forces, Elements, Casting Circle)
1. Story Dimension

Base container for a story.
Created through the Casting Circle.
Holds: World, Forces, Elements, Lore, Entities, Player Template.

2. Forces

Forces are mechanical systems that shape how the story dimension behaves.
They contain rules and schema that affect gameplay and AI behavior.

Examples:

Magic Force

Social Force

Dungeon/Adventure Force

Sanity/Fear/Mood Force

Augmentation/Implant Force

Superpower Force

Forces contribute:

State schema pieces

Action rules

Prompt rules

Mechanical constraints

Outcome rules

They define how the world behaves mechanically.

3. Elements (correct definition)

Elements are the worldbuilding pieces that give the story depth.
They populate the dimension.

Elements include:

NPCs

Villagers

Major characters

Factions

Items

Weapons

Artifacts

Potions

Locations

Towns

Rooms

Regions

Creatures / Monsters

Objects / Props / Interactables

Elements are the “content” of the world, not the mechanics.
They are not tied to a specific Force — they exist independently and are referenced by Forces only when needed.

4. Lore

Lore is the narrative text knowledge that enriches the Elements and World.

Examples:

History

Events

Cultures

Myths

Books

Faction descriptions

Region notes

Character backstories

Lore feeds into the RAG index at compile time.

Lore = text facts
Elements = content objects
Forces = mechanical systems

5. Casting Circle

Creation environment metaphor.
Contains four stones:

World Stone

Defines essence model

Geography

Tone

Global rules

Initial schema contributions

Forces Stone

Add or remove mechanical systems

Configure rules

Shape gameplay

Elements Stone

Add NPCs, items, monsters, locations, creatures

Populate the world

Lore Stone

Pure narrative context

Books, histories, cultures, mythos

Flavor text

RAG data

All four stones combine to shape the Story Dimension.

6. Relation Between Forces, Elements, Lore

Here is the final conceptual relationship:

Forces

Govern mechanics

Define schemas & rules

Elements

Populate the world as objects/entities

Lore

Provides background knowledge for immersion & RAG

Elements do not live inside Forces.
Elements can reference Forces only via the parts of schema those Forces added.

Example:
The Magic Force adds “mana” to entities.
An NPC Element may then specify “mana: 35.”