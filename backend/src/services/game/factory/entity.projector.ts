import { CharacterTemplate } from '../../../../domain/character.types';
import { ActiveEntity } from '../../../../domain/game-state.types';

export class EntityProjector {
    /**
     * Projects a CharacterTemplate into an ActiveEntity by merging it with ruleset defaults.
     * Separates mechanical properties from narrative visuals.
     * 
     * @param template The persistent character record (chimera_player_characters)
     * @param mechanicalDefaults Default stats from RulesetHarvester (e.g., HP: 100)
     * @param visualDefaults Default narrative attributes from RulesetHarvester
     */
    public project(
        template: CharacterTemplate,
        mechanicalDefaults: Record<string, any>,
        visualDefaults: Record<string, any>
    ): { entity: ActiveEntity; visuals: Record<string, string> } {

        // 1. Merge Defaults with Template Data (Template takes precedence)
        // The template stores raw props in 'state_snapshot.tier1_entity' which is the explicit stats block
        const rawProps = {
            ...mechanicalDefaults,
            ...(template.state_snapshot?.tier1_entity || {})
        };

        // 2. Separate Visuals (that might have snuck into props or are in visuals defaults)
        const visuals: Record<string, string> = { ...visualDefaults };

        // If the template has specific appearance override in the snapshot, use it
        if (template.state_snapshot?.appearance) {
            visuals[template.id] = template.state_snapshot.appearance;
        }
        // also check if 'appearance' or 'description' ended up in rawProps (e.g. from tier1_entity overrides)
        if (rawProps.appearance) {
            visuals[template.id] = rawProps.appearance;
            delete rawProps.appearance; // Keep mechanical pure
        }
        if (rawProps.description) {
            // If description is in props, treat as visual for the entity ID
            // Note: NarrativeFocus visuals are Record<EntityId, string>
            // We might want to append or allow explicit 'visuals' field in snapshot.
            // For now, simple extraction:
            if (!visuals[template.id]) visuals[template.id] = rawProps.description;
            delete rawProps.description;
        }

        // 3. Build Active Entity
        const entity: ActiveEntity = {
            id: template.id, // Use the Template ID (UUID)
            type: 'PLAYER',
            status: 'active',
            properties: rawProps // The clean, math-ready stats
        };

        return { entity, visuals };
    }
}
