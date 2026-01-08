import { ReactNode } from 'react';
import { EntityLink } from '@/features/play/components/Narrative/EntityLink';

interface EntityDefinition {
    id: string;
    name: string;
    type: 'npc' | 'enemy' | 'item' | 'other';
}

/**
 * Parses text and replaces known entity names with EntityLink components.
 * Returns an array of ReactNodes.
 */
export function parseEntitiesInText(text: string, entities: Record<string, { name: string; type: string }>): ReactNode[] {
    if (!text) return [];

    const nodes: ReactNode[] = [text];

    // Convert entities record to array for sorting/processing
    const entityList: EntityDefinition[] = Object.entries(entities).map(([id, data]) => ({
        id,
        name: data.name,
        type: data.type as any
    }));

    // Sort by name length (descending) to match longest strings first (Greedy match)
    // Helps with "King Arthur" vs "King"
    entityList.sort((a, b) => b.name.length - a.name.length);

    // Process nodes for each entity
    entityList.forEach(entity => {
        // We iterate through the current nodes array and split any strings we find
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // Only process valid string nodes
            if (typeof node !== 'string') continue;

            // Regex for exact word boundary match
            // Escape special regex chars in name
            const escapedName = entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b(${escapedName})\\b`, 'gi');

            const matches = node.split(regex);

            // If split resulted in more than 1 part, we have matches
            if (matches.length > 1) {
                const newNodes: ReactNode[] = [];
                matches.forEach((part, index) => {
                    // Even indices are surrounding text, Odd indices are the matches (capturing group)
                    if (index % 2 === 1) {
                        newNodes.push(
                            <EntityLink
                                key={`${entity.id}-${i}-${index}`}
                                id={entity.id}
                                name={part} // Keep original casing from text
                                type={entity.type}
                            />
                        );
                    } else if (part) {
                        newNodes.push(part);
                    }
                });

                // Replace the single string node with our new array of nodes
                nodes.splice(i, 1, ...newNodes);
                // Adjust index to skip the nodes we just inserted
                i += newNodes.length - 1;
            }
        }
    });

    return nodes;
}
