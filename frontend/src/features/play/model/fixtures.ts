import { PlayViewSchema, type PlayView } from "./play-view";
import type { LogEntry } from "../components/Narrative/types";

export const corePlayView = PlayViewSchema.parse({
  version: 1,
  title: "The Gilded Ledger",
  committed_turn: 14,
  rulesets: [
    "vitality-stamina-system",
    "needs-survival-basic",
    "d100-5-pillars",
    "wealth-capability-lite",
  ],
  player: { name: "Daakon", description: "Adventurer · Brave, Stoic" },
  scene: {
    name: "The Gilded Stag",
    time: "Deep Night",
    atmosphere: "Lighthearted",
    tags: ["Rain", "Woodsmoke"],
  },
  presence: {
    availability: "available",
    cast: [
      {
        id: "kiera",
        name: "Kiera",
        identified: true,
        role: "Bartender and tavern owner",
        disposition: "Friendly · Guarded",
        known_count: 4,
      },
      {
        id: "stranger",
        name: "Hooded stranger",
        identified: false,
        role: "Unidentified",
        disposition: "Still",
        known_count: 1,
      },
    ],
  },
  modules: [
    {
      id: "condition",
      kind: "conditions",
      label: "Condition",
      source: "vitality-stamina-system",
      fields: [
        {
          id: "physical_condition",
          label: "Condition",
          path: "player.physical_condition",
          value: "Rested",
        },
      ],
    },
    {
      id: "stamina",
      kind: "vitals",
      label: "Stamina",
      source: "vitality-stamina-system",
      fields: [
        {
          id: "current_stamina",
          label: "Stamina",
          path: "player.current_stamina",
          value: 90,
          max: 100,
          delta: -10,
          tone: "stamina",
        },
      ],
    },
    {
      id: "survival",
      kind: "conditions",
      label: "Survival",
      source: "needs-survival-basic",
      fields: [
        {
          id: "hunger_state",
          label: "Hunger",
          path: "player.hunger_state",
          value: "Well fed",
        },
      ],
    },
    {
      id: "satiety",
      kind: "vitals",
      label: "Satiety",
      source: "needs-survival-basic",
      fields: [
        {
          id: "satiety",
          label: "Satiety",
          path: "player.satiety",
          value: 80,
          max: 100,
          tone: "accent",
        },
      ],
    },
    {
      id: "pillars",
      kind: "pillars",
      label: "Pillars",
      source: "d100-5-pillars",
      fields: [
        {
          id: "root_force",
          label: "Force",
          path: "player.root_force",
          value: 40,
          max: 100,
        },
        {
          id: "root_finesse",
          label: "Finesse",
          path: "player.root_finesse",
          value: 60,
          max: 100,
        },
        {
          id: "root_awareness",
          label: "Awareness",
          path: "player.root_awareness",
          value: 55,
          max: 100,
        },
        {
          id: "root_insight",
          label: "Insight",
          path: "player.root_insight",
          value: 45,
          max: 100,
        },
        {
          id: "root_influence",
          label: "Influence",
          path: "player.root_influence",
          value: 50,
          max: 100,
        },
      ],
    },
    {
      id: "means",
      kind: "values",
      label: "Means",
      source: "wealth-capability-lite",
      fields: [
        {
          id: "wealth_tier",
          label: "Tier",
          path: "player.wealth_tier",
          value: 1,
        },
        {
          id: "archetype_loadout",
          label: "Loadout",
          path: "player.archetype_loadout",
          value: "Civilian",
        },
      ],
    },
  ],
});
export const socialPlayView = PlayViewSchema.parse({
  version: 1,
  title: "An evening of conversation",
  committed_turn: 3,
  rulesets: ["npc-relationships"],
  player: { name: "Mara" },
  scene: { name: "The courtyard", time: "Evening" },
  presence: {
    availability: "available",
    cast: [
      {
        id: "guest",
        name: "A visiting poet",
        identified: false,
        disposition: "Warm",
        known_count: 1,
      },
    ],
  },
  modules: [],
});
export const combatPlayView = PlayViewSchema.parse({
  ...corePlayView,
  title: "The broken bridge",
  rulesets: ["cinematic-combat-lite", "vitality-stamina-system"],
  scene: { name: "The bridge", time: "Dusk" },
  presence: { availability: "empty", cast: [] },
  modules: [
    corePlayView.modules[1],
    {
      id: "combat",
      kind: "conditions",
      label: "Combat condition",
      source: "cinematic-combat-lite",
      fields: [
        {
          id: "combat_condition",
          label: "Condition",
          path: "player.combat_condition",
          value: "Wounded",
        },
      ],
    },
    {
      id: "prowess",
      kind: "values",
      label: "Combat prowess",
      source: "cinematic-combat-lite",
      fields: [
        {
          id: "combat_prowess",
          label: "Prowess",
          path: "player.combat_prowess",
          value: 55,
        },
      ],
    },
  ],
});
export const playFixtures: Record<string, PlayView> = {
  core: corePlayView,
  social: socialPlayView,
  combat: combatPlayView,
};
export const fixtureLogs: LogEntry[] = [
  {
    id: "player-14",
    role: "player",
    text: "I lean on the bar and ask Kiera who the stranger is.",
    timestamp: new Date("2026-09-30T00:00:00Z"),
  },
  {
    id: "narrator-14",
    role: "narrator",
    text: "Rain has drummed on the Gilded Stag’s shutters for an hour, and the taproom smells of woodsmoke and wet wool. You lean against the bar, close enough to hear the hooded stranger breathe.\n\n“Paid in silver, asked for nothing, hasn’t touched his ale,” Kiera murmurs, polishing a mug she has already polished twice. “Either he’s waiting for someone, or someone’s waiting for him.”",
    timestamp: new Date("2026-09-30T00:00:00Z"),
  },
];

export const fixtureTranscripts: Record<string, LogEntry[]> = {
  core: fixtureLogs,
  social: [
    {
      id: "social-intro",
      role: "narrator",
      text: "The visiting poet pauses beside the courtyard fountain, waiting for your reply.",
      timestamp: new Date("2026-09-30T00:00:00Z"),
    },
  ],
  combat: [
    {
      id: "combat-intro",
      role: "narrator",
      text: "The bridge creaks beneath your feet. The far bank is quiet, and you pause to catch your breath.",
      timestamp: new Date("2026-09-30T00:00:00Z"),
    },
  ],
};
export const fixtureSuggestions: Record<string, string[]> = {
  core: ["Watch the stranger quietly", "Ask Kiera about the silver"],
  social: ["Ask about the poem"],
  combat: ["Look for a way across"],
};
