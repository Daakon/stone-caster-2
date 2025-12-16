import React from 'react';
import { ResourceGrid } from '@/components/common/ResourceGrid';
import { SectionHeader } from '@/components/common/SectionHeader';
import { WorldCard } from '@/features/dashboard/components/cards/WorldCard';
import { EntityCard } from '@/features/dashboard/components/cards/EntityCard';
import { StoryCard } from '@/features/dashboard/components/cards/StoryCard';
import type { ChimeraWorldV2, ChimeraEntityV2, ChimeraStoryV2 } from '@/types/chimera-v2';

// Mock Data
const MOCK_WORLD: ChimeraWorldV2 = {
    id: 'world-1',
    display_name: 'Kingdom of Aethelgard',
    tags: ['Fantasy', 'Medieval'],
    images: [], // Should fallback to determinstic gradient
    status: 'published',
    updated_at: new Date().toISOString()
};

const MOCK_ENTITY: ChimeraEntityV2 = {
    id: 'entity-1',
    display_name: 'Sir Galahad',
    entity_type: 'NPC',
    archetype_handle: 'warrior',
    images: [], // Should fallback
    status: 'ready',
    updated_at: new Date().toISOString()
};

const MOCK_STORY: ChimeraStoryV2 = {
    id: 'story-1',
    display_name: 'The Lost Artifact',
    world_id: 'world-1',
    world_display_name: 'Kingdom of Aethelgard',
    status: 'draft',
    updated_at: new Date().toISOString()
};

export default function TestGalleryPage() {
    return (
        <div className="container mx-auto py-10 space-y-12 bg-stone-950 min-h-screen text-stone-200 p-8">
            <h1 className="text-4xl font-bold mb-8 text-white">Visual Component Gallery</h1>

            {/* Worlds Section */}
            <section>
                <SectionHeader
                    title="Worlds"
                    actionLabel="New World"
                    onAction={() => console.log('New World')}
                />
                <ResourceGrid>
                    <WorldCard data={MOCK_WORLD} />
                    <WorldCard data={{ ...MOCK_WORLD, id: 'world-2', display_name: 'Cyberpunk City 2099', tags: ['Sci-Fi'] }} />
                    <WorldCard data={{ ...MOCK_WORLD, id: 'world-3', display_name: 'Empty World', images: [] }} />
                </ResourceGrid>
            </section>

            {/* Entities Section */}
            <section>
                <SectionHeader
                    title="Entities"
                    actionLabel="New Entity"
                    onAction={() => console.log('New Entity')}
                />
                <ResourceGrid>
                    <EntityCard data={MOCK_ENTITY} />
                    <EntityCard data={{ ...MOCK_ENTITY, id: 'entity-2', display_name: 'Magic Sword', entity_type: 'ITEM' }} />
                    <EntityCard data={{ ...MOCK_ENTITY, id: 'entity-3', display_name: 'Dark Forest', entity_type: 'LOCATION' }} />
                </ResourceGrid>
            </section>

            {/* Stories Section */}
            <section>
                <SectionHeader
                    title="Stories"
                    actionLabel="New Story"
                    onAction={() => console.log('New Story')}
                />
                <ResourceGrid>
                    <StoryCard data={MOCK_STORY} />
                    <StoryCard data={{ ...MOCK_STORY, id: 'story-2', display_name: 'Rise of the Machines', status: 'published' }} />
                </ResourceGrid>
            </section>

            {/* Empty State Test */}
            <section>
                <SectionHeader title="Empty State Test" />
                <ResourceGrid isEmpty emptyState={<div>No items found. Create one!</div>}>
                    {/* Children should not render */}
                    <div className="bg-red-500 w-full h-20">Should not see this</div>
                </ResourceGrid>
            </section>
        </div>
    );
}
