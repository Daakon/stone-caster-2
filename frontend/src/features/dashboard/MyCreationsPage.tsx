/**
 * My Creations Page
 * Landing page for creators - entry point to Story Creation Wizard
 * 
 * Architecture: Lore is contextual memory attached to Worlds/Entities, not a peer domain
 * 
 * Layout Order:
 * 1. Hero: "Compose Story" (Primary CTA)
 * 2. Section A: "My Stories" (High-frequency area - drafts and published)
 * 3. Section B: "The Workshop" (Worlds | Entities with inline context actions)
 * 4. Section C: "System Memory" (Recent context feed - terminal aesthetic)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useStoryDraftStore } from '../create-story';
import { MOCK_USER_WORLDS, MOCK_USER_ENTITIES, MOCK_USER_LORE, MOCK_USER_STORIES } from '../create-story/data/mock-library';
import { StoryListSection } from './components/StoryListSection';
import { AssetDomainCard } from './components/AssetDomainCard';
import { RecentContextFeed } from './components/RecentContextFeed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function MyCreationsPage() {
  const navigate = useNavigate();
  const initializeDraft = useStoryDraftStore((state) => state.initializeDraft);
  const clearDraft = useStoryDraftStore((state) => state.clearDraft);

  const handleNewStory = () => {
    // Clear any existing draft state
    clearDraft();

    // Initialize a new draft
    const draftId = `draft-${Date.now()}`;
    initializeDraft(draftId, {
      title: '',
      summary: '',
      genre_tags: [],
      safety_filters: ['pg'],
      ruleset_keys: [],
    });

    // Navigate to the creation wizard
    navigate('/create-story');
  };

  const handleAddContext = (itemId: string, itemName: string, type: 'world' | 'entity') => {
    // Log intent for now - in production, this would open a modal
    console.log(`[MyCreationsPage] Add context to ${type}:`, {
      id: itemId,
      name: itemName,
      type,
    });
    // TODO: Open LoreManagerModal with parent context pre-filled
  };

  const handleEditWorld = (worldId: string) => {
    // Navigate to world editor
    console.log(`[MyCreationsPage] Edit world:`, worldId);
    // TODO: Navigate to world editor
  };

  const handleEditEntity = (entityId: string) => {
    // Navigate to entity editor
    console.log(`[MyCreationsPage] Edit entity:`, entityId);
    // TODO: Navigate to entity editor
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">My Creations</h1>
          <p className="text-muted-foreground">
            Create and manage your stories, worlds, and content
          </p>
        </div>

        {/* Hero: Compose Story */}
        <Card className="border-2 border-dashed hover:border-primary transition-colors cursor-pointer" onClick={handleNewStory}>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl mb-2">Compose Story</CardTitle>
            <CardDescription className="text-base mb-6 max-w-md">
              Start crafting a new interactive story with the Casting Circle wizard
            </CardDescription>
            <Button size="lg" className="min-h-[44px] min-w-[200px]">
              <Plus className="h-5 w-5 mr-2" />
              Begin Creation
            </Button>
          </CardContent>
        </Card>

        {/* Section A: My Stories */}
        <StoryListSection stories={MOCK_USER_STORIES} />

        {/* Section B: The Workshop: 2-Column Layout */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold mb-2">The Workshop</h2>
            <p className="text-muted-foreground text-sm">
              Manage your library of assets.
            </p>
          </div>

          {/* 2-Column Grid: Worlds (Left) | Entities (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Worlds Column */}
            <AssetDomainCard
              title="Worlds"
              description="Your created worlds and settings"
              items={MOCK_USER_WORLDS}
              type="world"
              onAddContext={handleAddContext}
              onEdit={handleEditWorld}
            />

            {/* Entities Column */}
            <AssetDomainCard
              title="Entities"
              description="Characters, NPCs, and other entities"
              items={MOCK_USER_ENTITIES}
              type="entity"
              onAddContext={handleAddContext}
              onEdit={handleEditEntity}
            />
          </div>
        </div>

        {/* Section C: System Memory: Recent Context Feed */}
        {MOCK_USER_LORE.length > 0 && (
          <div className="space-y-4">
            <RecentContextFeed recentLore={MOCK_USER_LORE} maxItems={5} />
          </div>
        )}
      </div>
    </div>
  );
}
