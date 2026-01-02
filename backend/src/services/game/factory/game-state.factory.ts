import { RulesetHarvester } from './ruleset.harvester';
import { EntityProjector } from './entity.projector';
import { GameStateBundle, MechanicalState, NarrativeFocus, SceneRegistry } from '../../../domain/game-state.types';
import { CharacterTemplate } from '../../../domain/character.types';

export class GameStateFactory {
    constructor(
        private harvester: RulesetHarvester,
        private projector: EntityProjector
    ) { }

    /**
     * Orchestrates the creation of a new Game State Bundle.
     * 1. Harvests ruleset variables (Mech vs Narr).
     * 2. Projects the Player Entity.
     * 3. Initialises Mechanical, Narrative, and Registry states.
     * 
     * @param storyId The ID of the story/game session (could be same as drafted story, or unique session ID)
     * @param playerTemplate The raw character row from DB (chimera_player_characters)
     * @param activeRulesets The array of ruleset definition objects
     */
    public createBundle(
        storyId: string,
        playerTemplate: CharacterTemplate,
        activeRulesets: any[]
    ): GameStateBundle {

        // 1. Harvest Ruleset Requirements (Sort Logic)
        const { globals, entityDefaults, visualDefaults } = this.harvester.harvest(activeRulesets);

        // 2. Project Player Entity (Map Logic)
        const { entity: playerEntity, visuals: playerVisuals } = this.projector.project(
            playerTemplate,
            entityDefaults,
            visualDefaults
        );

        // 3. Assemble Mechanical State (The Engine Room)
        const mechanical: MechanicalState = {
            globals: globals,
            entities: { [playerEntity.id]: playerEntity },
            index: { player_id: playerEntity.id }
        };

        // 4. Assemble Narrative Focus (The Stage)
        const narrative: NarrativeFocus = {
            scene_context: {
                name: "The Beginning", // Future: Fetch from World Config or Story Start
                description: "Your journey begins...", // Future: Generate via AI or use 'opening_text' from Story
                atmosphere: "Anticipation"
            },
            entity_visuals: playerVisuals,
            dialogue_history: []
        };

        // 5. Assemble Scene Registry (The Background)
        const registry: SceneRegistry = {
            active_scene_id: "start_node",
            entity_locations: { [playerEntity.id]: "start_node" },
            node_states: {}
        };

        return { mechanical, narrative, registry, queue: [] };
    }
}
