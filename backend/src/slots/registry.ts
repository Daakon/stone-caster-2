/**
 * Slot & Template Registries
 * Lightweight in-memory registries for slots and templates
 */

export type SlotType = 'world' | 'ruleset' | 'npc' | 'scenario' | 'module' | 'ux';

export interface SlotDefinition {
  type: SlotType;
  name: string;
  description: string;
  max_len?: number;
  priority?: number;
}

export interface TemplateDefinition {
  type: SlotType;
  slot: string;
  version: string;
  body: string;
  status: 'draft' | 'published';
}

/**
 * In-memory slot registry
 */
class SlotRegistry {
  private slots = new Map<string, SlotDefinition>();

  register(slot: SlotDefinition): void {
    const key = `${slot.type}.${slot.name}`;
    this.slots.set(key, slot);
  }

  get(type: SlotType, name: string): SlotDefinition | null {
    const key = `${type}.${name}`;
    return this.slots.get(key) || null;
  }

  getAll(type?: SlotType): SlotDefinition[] {
    if (type) {
      return Array.from(this.slots.values()).filter(s => s.type === type);
    }
    return Array.from(this.slots.values());
  }
}

/**
 * In-memory template registry
 */
class TemplateRegistry {
  private templates = new Map<string, TemplateDefinition[]>();

  register(template: TemplateDefinition): void {
    const key = `${template.type}.${template.slot}`;
    const existing = this.templates.get(key) || [];
    existing.push(template);
    // Sort by version descending (newest first)
    existing.sort((a, b) => b.version.localeCompare(a.version));
    this.templates.set(key, existing);
  }

  get(type: SlotType, slot: string, version?: string): TemplateDefinition | null {
    const key = `${type}.${slot}`;
    const templates = this.templates.get(key) || [];
    
    if (version) {
      return templates.find(t => t.version === version) || null;
    }
    
    // Return published version, or latest draft if no published
    const published = templates.find(t => t.status === 'published');
    if (published) return published;
    
    return templates[0] || null;
  }

  getAll(type?: SlotType, slot?: string): TemplateDefinition[] {
    let result: TemplateDefinition[] = [];
    
    for (const templates of this.templates.values()) {
      for (const template of templates) {
        if (type && template.type !== type) continue;
        if (slot && template.slot !== slot) continue;
        result.push(template);
      }
    }
    
    return result;
  }
}

// Singleton instances
export const slotRegistry = new SlotRegistry();
export const templateRegistry = new TemplateRegistry();

/**
 * Seed initial slots and templates
 */
export function seedSlotsAndTemplates(): void {
  // Register 5 slots
  slotRegistry.register({
    type: 'world',
    name: 'tone',
    description: 'World narrative tone and atmosphere',
    max_len: 500,
    priority: 1,
  });

  slotRegistry.register({
    type: 'ruleset',
    name: 'principles',
    description: 'Core narrative principles for the ruleset',
    max_len: 1000,
    priority: 1,
  });

  slotRegistry.register({
    type: 'ruleset',
    name: 'choice_style',
    description: 'Style guide for presenting choices to players',
    max_len: 300,
    priority: 2,
  });

  slotRegistry.register({
    type: 'npc',
    name: 'bio',
    description: 'NPC biographical information',
    max_len: 400,
    priority: 1,
  });

  slotRegistry.register({
    type: 'npc',
    name: 'persona',
    description: 'NPC personality and behavioral traits',
    max_len: 300,
    priority: 2,
  });

  // Seed 5 templates with simple Mustache placeholders
  templateRegistry.register({
    type: 'world',
    slot: 'tone',
    version: '1.0.0',
    body: 'The world of {{world.name}} has a {{world.tone}} atmosphere. {{world.tone_description}}',
    status: 'published',
  });

  templateRegistry.register({
    type: 'ruleset',
    slot: 'principles',
    version: '1.0.0',
    body: '## Narrative Principles\n\n{{ruleset.principles_text}}\n\nThese principles guide all storytelling decisions.',
    status: 'published',
  });

  templateRegistry.register({
    type: 'ruleset',
    slot: 'choice_style',
    version: '1.0.0',
    body: 'Present choices in a {{ruleset.choice_style}} manner. {{ruleset.choice_style_guidance}}',
    status: 'published',
  });

  templateRegistry.register({
    type: 'npc',
    slot: 'bio',
    version: '1.0.0',
    body: '{{npc.name}} is {{npc.bio_text}}. {{npc.bio_background}}',
    status: 'published',
  });

  templateRegistry.register({
    type: 'npc',
    slot: 'persona',
    version: '1.0.0',
    body: '{{npc.name}} exhibits {{npc.persona_traits}}. {{npc.persona_behavior}}',
    status: 'published',
  });
}

// Auto-seed on module load
seedSlotsAndTemplates();

