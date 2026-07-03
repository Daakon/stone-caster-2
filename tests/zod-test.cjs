const { z } = require('zod');

const DirectorUnifiedIntentSchema = z.object({
  turn_meta: z.object({
    resolution_mode: z.enum(['engine', 'narrative']),
    atmosphere_shift: z.string().optional(),
    time_jump_minutes: z.number().int().default(0),
  }),
  unseen_ripples: z.array(z.object({
    target_id: z.string().uuid(),
    type: z.enum(['relationship', 'emotional', 'status']),
    delta_tier: z.enum(['Minor', 'Moderate', 'Major', 'Severe']),
    property_path: z.string(),
    reason: z.string(),
  })).default([]),
  intent_queue: z.array(z.object({
    actor_id: z.string().uuid(),
    trigger_id: z.string(),
    intended_targets: z.array(z.string().uuid()),
    proximity_cluster: z.array(z.string().uuid()).default([]),
    parameters: z.object({
      verb: z.string(),
      impact_tier: z.enum(['Low', 'Moderate', 'High', 'Severe']).optional(),
      tactic_tag: z.string().optional(),
      skill_id: z.string().optional(),
    }),
  })).default([]),
});

const baseResponse = {
  turn_meta: {
    resolution_mode: 'engine',
    atmosphere_shift: 'Tense',
    time_jump_minutes: 0,
  },
  unseen_ripples: [],
  intent_queue: [],
};

const TARGET_GUARD_ID = '39757d45-2426-4377-a5d0-e99e9681d1ff';
const TARGET_KIERA_ID = '789dbece-3bc9-4080-82ce-31b47139fbb5';
const TARGET_BARTENDER_ID = '00f2f66c-4ece-46df-ace9-af89a488c077';

const test_mixed = {
  ...baseResponse,
  intent_queue: [
    {
      actor_id: '00000000-0000-0000-0000-000000000000',
      trigger_id: 'combat_action',
      intended_targets: [TARGET_GUARD_ID],
      proximity_cluster: [],
      parameters: { verb: 'attack', tactic_tag: 'defensive', skill_id: 'root_force', impact_tier: 'Low' }
    },
    {
      actor_id: '00000000-0000-0000-0000-000000000000',
      trigger_id: 'rest_action',
      intended_targets: [],
      proximity_cluster: [],
      parameters: { verb: 'rest', impact_tier: 'Low' }
    }
  ],
  turn_meta: { ...baseResponse.turn_meta, time_jump_minutes: 15 }
};

const test_social = {
  ...baseResponse,
  turn_meta: { ...baseResponse.turn_meta, resolution_mode: 'narrative' },
  intent_queue: [
    {
      actor_id: '00000000-0000-0000-0000-000000000000',
      trigger_id: 'social_action',
      intended_targets: [TARGET_BARTENDER_ID],
      proximity_cluster: [],
      parameters: { verb: 'flirt', skill_id: 'root_awareness', impact_tier: 'Moderate' }
    }
  ],
  unseen_ripples: [
    { target_id: TARGET_BARTENDER_ID, type: 'emotional', delta_tier: 'Minor', property_path: 'relationships.player.desire', reason: 'Player flirted successfully' }
  ]
};

const test_travel = {
  ...baseResponse,
  intent_queue: [
    {
      actor_id: '00000000-0000-0000-0000-000000000000',
      trigger_id: 'navigate',
      intended_targets: [],
      proximity_cluster: [],
      parameters: { verb: 'travel', impact_tier: 'Low' }
    }
  ],
  turn_meta: { ...baseResponse.turn_meta, time_jump_minutes: 60 }
};

const datasets = { test_mixed, test_social, test_travel };

for (const [name, data] of Object.entries(datasets)) {
  try {
    DirectorUnifiedIntentSchema.parse(data);
    console.log(name, "OK");
  } catch (e) {
    console.log(name, "FAILED", JSON.stringify(e.errors, null, 2));
  }
}
