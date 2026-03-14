
import { z } from 'zod';

const Mas1IntentSchema = z.object({
    trigger_id: z.enum(['combat_action', 'social_action', 'rest_action', 'attempt_action', 'navigate']),
    target_ids: z.array(z.string().uuid()),
    parameters: z.object({
        verb: z.string(),
        tactic_tag: z.string().optional(),
        difficulty_mod: z.number().optional(),
        skill_id: z.string().optional(),
    }),
    duration_tag: z.enum(['moment', 'scene', 'journey', 'rest']),
    situational_tags: z.array(z.string()).optional(),
    original_text: z.string(),
});

const TARGET_GUARD_ID = '39757d45-2426-4377-a5d0-e99e9681d1ff';
const TARGET_KIERA_ID = '789dbece-3bc9-4080-82ce-31b47139fbb5';
const userText = 'test_combat';

const mockData = {
    trigger_id: 'combat_action',
    target_ids: [TARGET_GUARD_ID, TARGET_KIERA_ID],
    parameters: {
        verb: 'slash',
        tactic_tag: 'aggressive',
        skill_id: 'root_force',
    },
    duration_tag: 'moment',
    original_text: userText,
};

try {
    console.log('Validating mock data...');
    Mas1IntentSchema.parse(mockData);
    console.log('Validation successful!');
} catch (error) {
    console.error('Validation failed:', JSON.stringify(error, null, 2));
}
