
export class NarrativeGenesisService {
    /**
     * Generates the opening narrative for a story based on the "Director's Slate" (Genesis Config).
     * 
     * @param genesisConfig - Configuration from the story draft (set design, cast, etc.)
     * @param playerName - Name of the player character
     * @returns The formatted opening narrative text (Markdown)
     */
    async generateOpening(
        genesisConfig: any,
        playerName: string,
        stars: any[] = []
    ): Promise<{ narrative: string, entities: any[] }> {
        // Default fallback if config is missing
        const config = genesisConfig || {};
        const pacing = config.pacing || 'balanced';
        const narratorTone = config.narrator_tone || 'Standard';
        const perspective = config.perspective || 'second_person';
        const setDesign = config.set_design || 'A quiet void.';
        const action = config.opening_action || 'You arrive.';

        // Parse Cast list
        let castNames: string[] = [];
        const extraEntities: any[] = [];

        // 1. Process Extras (Ad-hoc)
        if (Array.isArray(config.cast_extras)) {
            config.cast_extras.forEach((extra: any, index: number) => {
                if (extra.name || extra.visual_alias) {
                    const displayName = extra.visual_alias || extra.name || 'Unknown Extra';
                    const hiddenName = extra.name || `Extra ${index + 1}`;
                    const archetype = extra.archetype ? `Role: ${extra.archetype}` : 'Role: Generic';

                    castNames.push(`${displayName} (${archetype})`);

                    // Build Description from Traits
                    const traits = [];
                    if (extra.race) traits.push(`Race: ${extra.race}`);
                    if (extra.attire) traits.push(`Wearing: ${extra.attire}`);
                    if (extra.quirk) traits.push(`Quirk: ${extra.quirk}`);

                    const description = traits.length > 0 ? traits.join(', ') : 'No specific visual traits defined.';

                    extraEntities.push({
                        id: extra.id || `genesis_extra_${index}`,
                        type: 'NPC',
                        status: 'active',
                        properties: {
                            name: hiddenName,
                            display_name: displayName, // Store visible name too
                            description: description,
                            archetype: extra.archetype,
                            race: extra.race,
                            attire: extra.attire,
                            quirk: extra.quirk,
                            tags: ['genesis_spawn', 'extra']
                        }
                    });
                }
            });
        }

        // 2. Process Stars (Resolved Entities)
        if (stars && stars.length > 0) {
            stars.forEach(star => {
                castNames.push(`${star.display_name || star.name} (Star)`);
            });
        }

        // Legacy Fallback (String)
        if (castNames.length === 0 && config.initial_cast) {
            const legacyNames = typeof config.initial_cast === 'string'
                ? config.initial_cast.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
                : [];

            castNames.push(...legacyNames);

            // Auto-generate entities for legacy names
            legacyNames.forEach((name: string, index: number) => {
                extraEntities.push({
                    id: `genesis_npc_${Math.floor(Date.now() / 1000)}_${index}`,
                    type: 'NPC',
                    status: 'active',
                    properties: {
                        name: name,
                        tags: ['genesis_spawn']
                    }
                });
            });
        }

        const castDisplay = castNames.length > 0 ? castNames.join(', ') : 'None';

        // --- DUAL-TRACK PROMPTING ---

        // Track 1: Narrator Directive (The Lens)
        // Controls how the world is described.
        let pacingDirective = '';
        if (pacing === 'concise') pacingDirective = 'Be brief, direct, and action-oriented.';
        if (pacing === 'balanced') pacingDirective = 'Balance action with description.';
        if (pacing === 'descriptive') pacingDirective = 'Prioritize atmosphere, sensory details, and immersion.';

        const perspectiveDirective = perspective === 'second_person'
            ? 'Write in SECOND PERSON ("You see", "You hear").'
            : `Write in THIRD PERSON ("${playerName} sees", "He/She hears").`;

        const narratorPrompt = `
> **NARRATOR LENS**
> ROLE: Game Master
> PERSPECTIVE: ${perspectiveDirective}
> TONE: ${narratorTone}. Apply this tone to the environment and narration.
> PACING: ${pacingDirective}
`;

        // Track 2: Actor Directive (The Firewall)
        // Protects NPC agency from Narrator Tone.
        const actorPrompt = `
> **ACTOR DIRECTIVE (THE FIREWALL)**
> NPCs must act according to their own defined personalities and roles, NOT the Narrator Tone.
> - ${stars.length > 0 ? 'EXISTING NPCs (Stars): Stick strictly to their established character traits.' : ''}
> - EXTRAS: Act according to their specific visual traits and archetypes defined below.
`;

        // Scene Context
        const scenePrompt = `
**SCENE SETUP**
SETTING: ${setDesign}
ACTION HOOK: ${action}

**CAST**
STARS: ${stars.map(s => `${s.display_name || s.name}`).join(', ') || 'None'}
EXTRAS: 
${config.cast_extras?.map((e: any) => {
            const alias = e.visual_alias || e.name || 'Unknown';
            const archetype = e.archetype || 'Generic';
            const race = e.race || '[Generate]';
            const attire = e.attire || '[Generate]';
            const quirk = e.quirk || '[Generate]';
            return `- ${alias} (${archetype}): Race: ${race}, Attire: ${attire}, Quirk: ${quirk}`;
        }).join('\n') || 'None'}
`;

        const openingText = `## The Story Begins...

${narratorPrompt}
${actorPrompt}
${scenePrompt}

${playerName} enters the scene...
`;

        return {
            narrative: openingText,
            entities: extraEntities // Only return NEW entities (extras). Stars are handled by caller.
        };
    }
}
