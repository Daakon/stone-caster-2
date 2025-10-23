import { createClient } from '@supabase/supabase-js';
import { assemblePrompt } from '../prompt/assembler/assembler';
import { estimateTokens } from '../prompt/budget';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface PreviewOptions {
  entryId: string;
  locale?: string;
  npcIds?: string[];
  maxTokens?: number;
  firstTurn?: boolean;
}

export interface PreviewResult {
  entry: {
    id: string;
    name: string;
    slug: string;
  };
  world: {
    id: string;
    name: string;
    slug: string;
  };
  rulesets: Array<{
    id: string;
    name: string;
    sort_order: number;
  }>;
  npcs: Array<{
    id: string;
    name: string;
    tier?: number;
  }>;
  prompt: string;
  meta: {
    segmentIdsByScope: Record<string, string[]>;
    budgets: {
      maxTokens: number;
      estTokens: number;
    };
    truncationMeta: any;
    assemblerVersion: string;
    locale: string;
  };
  lints: Array<{
    code: string;
    level: 'warn' | 'error';
    message: string;
  }>;
}

export async function generatePreview(options: PreviewOptions): Promise<PreviewResult> {
  const {
    entryId,
    locale = 'en',
    npcIds = [],
    maxTokens = 800,
    firstTurn = true,
  } = options;

  // Load entry with world
  const { data: entry, error: entryError } = await supabase
    .from('entries')
    .select(`
      id, name, slug, world_text_id, status,
      world:worlds!world_text_id(id, name, slug)
    `)
    .eq('id', entryId)
    .single();

  if (entryError || !entry) {
    throw new Error('Entry not found');
  }

  // Load ordered rulesets
  const { data: entryRulesets, error: rulesetsError } = await supabase
    .from('entry_rulesets')
    .select(`
      sort_order,
      ruleset:rulesets(id, name, slug)
    `)
    .eq('entry_id', entryId)
    .order('sort_order');

  if (rulesetsError) {
    throw new Error('Failed to load rulesets');
  }

  // Load bound NPCs
  let npcsQuery = supabase
    .from('entry_npcs')
    .select(`
      npc:npcs(id, name, slug)
    `)
    .eq('entry_id', entryId);

  if (npcIds.length > 0) {
    npcsQuery = npcsQuery.in('npc_id', npcIds);
  }

  const { data: entryNPCs, error: npcsError } = await npcsQuery;

  if (npcsError) {
    throw new Error('Failed to load NPCs');
  }

  // Prepare NPC data
  const npcs = entryNPCs?.map(entryNpc => ({
    id: entryNpc.npc.id,
    name: entryNpc.npc.name,
    tier: 0 // Default tier
  })) || [];

  // Assemble the prompt
  const assembleResult = await assemblePrompt({
    entryId,
    worldId: entry.world_text_id,
    rulesetIds: entryRulesets?.map(er => er.ruleset.id) || [],
    npcs,
    locale,
    isFirstTurn: firstTurn,
    inputText: '',
  });

  // Calculate token estimates
  const estTokens = estimateTokens(assembleResult.prompt);

  // Generate lints
  const lints = await generateLints({
    entry,
    world: entry.world,
    rulesets: entryRulesets?.map(er => er.ruleset) || [],
    npcs,
    locale,
    isFirstTurn: firstTurn,
    estTokens,
    maxTokens,
  });

  return {
    entry: {
      id: entry.id,
      name: entry.name,
      slug: entry.slug,
    },
    world: {
      id: entry.world.id,
      name: entry.world.name,
      slug: entry.world.slug,
    },
    rulesets: entryRulesets?.map(er => ({
      id: er.ruleset.id,
      name: er.ruleset.name,
      sort_order: er.sort_order,
    })) || [],
    npcs,
    prompt: assembleResult.prompt,
    meta: {
      segmentIdsByScope: assembleResult.meta.segmentIdsByScope,
      budgets: {
        maxTokens,
        estTokens,
      },
      truncationMeta: assembleResult.meta.truncationMeta,
      assemblerVersion: assembleResult.meta.assemblerVersion,
      locale,
    },
    lints,
  };
}

async function generateLints({
  entry,
  world,
  rulesets,
  npcs,
  locale,
  isFirstTurn,
  estTokens,
  maxTokens,
}: {
  entry: any;
  world: any;
  rulesets: any[];
  npcs: any[];
  locale: string;
  isFirstTurn: boolean;
  estTokens: number;
  maxTokens: number;
}): Promise<Array<{ code: string; level: 'warn' | 'error'; message: string }>> {
  const lints: Array<{ code: string; level: 'warn' | 'error'; message: string }> = [];

  // Check for missing world segment
  const { data: worldSegments } = await supabase
    .from('prompt_segments')
    .select('id')
    .eq('scope', 'world')
    .eq('ref_id', world.id)
    .eq('active', true);

  if (!worldSegments || worldSegments.length === 0) {
    lints.push({
      code: 'missing_world_segment',
      level: 'error',
      message: `No active world segment found for ${world.name} (${locale})`,
    });
  }

  // Check for missing ruleset segments
  for (const ruleset of rulesets) {
    const { data: rulesetSegments } = await supabase
      .from('prompt_segments')
      .select('id')
      .eq('scope', 'ruleset')
      .eq('ref_id', ruleset.id)
      .eq('active', true);

    if (!rulesetSegments || rulesetSegments.length === 0) {
      lints.push({
        code: 'missing_ruleset_segment',
        level: 'error',
        message: `No active ruleset segment found for ${ruleset.name} (${locale})`,
      });
    }
  }

  // Check for missing entry segment
  const { data: entrySegments } = await supabase
    .from('prompt_segments')
    .select('id')
    .eq('scope', 'entry')
    .eq('ref_id', entry.id)
    .eq('active', true);

  if (!entrySegments || entrySegments.length === 0) {
    lints.push({
      code: 'missing_entry_segment',
      level: 'error',
      message: `No active entry segment found for ${entry.name} (${locale})`,
    });
  }

  // Check for missing entry_start segment (if first turn)
  if (isFirstTurn) {
    const { data: entryStartSegments } = await supabase
      .from('prompt_segments')
      .select('id')
      .eq('scope', 'entry_start')
      .eq('ref_id', entry.id)
      .eq('active', true);

    if (!entryStartSegments || entryStartSegments.length === 0) {
      lints.push({
        code: 'missing_entry_start',
        level: 'warn',
        message: `No active entry_start segment found for ${entry.name} (${locale}) - recommended for first turn`,
      });
    }
  }

  // Check for NPCs without tier-0 content
  for (const npc of npcs) {
    const { data: npcSegments } = await supabase
      .from('prompt_segments')
      .select('id, metadata')
      .eq('scope', 'npc')
      .eq('ref_id', npc.id)
      .eq('active', true);

    const hasTier0 = npcSegments?.some(segment => 
      segment.metadata?.tier === '0' || segment.metadata?.tier === 0
    );

    if (!hasTier0) {
      lints.push({
        code: 'npc_without_tier0',
        level: 'warn',
        message: `NPC ${npc.name} has no tier-0 content`,
      });
    }
  }

  // Check for over budget
  if (estTokens > maxTokens) {
    lints.push({
      code: 'over_budget_estimate',
      level: 'error',
      message: `Estimated tokens (${estTokens}) exceed maximum (${maxTokens})`,
    });
  }

  return lints;
}
