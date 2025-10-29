import React, { useState, useEffect } from 'react';
import { useNPCsQuery } from '@/lib/queries';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { NPCsFilterBar } from '@/components/filters/NPCsFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';

interface NPCFilters {
  q: string;
  world: string | undefined;
}

export default function NPCsPage() {
  const [filters, setFilters] = useState<NPCFilters>({
    q: '',
    world: undefined
  });

  // Load NPCs with current filters
  const { data: npcsData, isLoading, error } = useNPCsQuery({
    q: filters.q || undefined,
    world: filters.world,
  });

  const npcs = npcsData || [];

  // Track catalog view on mount
  useEffect(() => {
    trackCatalogView('npcs');
  }, []);

  const handleFiltersChange = (newFilters: NPCFilters) => {
    setFilters(newFilters);
  };

  const handleCardClick = (npcId: string) => {
    trackCatalogCardClick('npcs', npcId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">NPCs</h1>
            <p className="text-muted-foreground mt-2">
              Meet the characters you'll encounter in your adventures
            </p>
          </div>
          
          <NPCsFilterBar onFiltersChange={handleFiltersChange} />
          
          <CatalogGrid>
            {Array.from({ length: 6 }).map((_, index) => (
              <CatalogSkeleton key={index} />
            ))}
          </CatalogGrid>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">NPCs</h1>
            <p className="text-muted-foreground mt-2">
              Meet the characters you'll encounter in your adventures
            </p>
          </div>
          
          <NPCsFilterBar onFiltersChange={handleFiltersChange} />
          
          <EmptyState
            title="Error loading NPCs"
            description="There was a problem loading the NPCs. Please try again."
            actionLabel="Refresh page"
            onAction={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (npcs.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">NPCs</h1>
            <p className="text-muted-foreground mt-2">
              Meet the characters you'll encounter in your adventures
            </p>
          </div>
          
          <NPCsFilterBar onFiltersChange={handleFiltersChange} />
          
          <EmptyState
            title="No NPCs found"
            description={
              Object.values(filters).some(v => v && v !== '')
                ? "No NPCs match your current filters. Try adjusting your search criteria."
                : "No NPCs are available at the moment. Check back later for new characters."
            }
            actionLabel="Clear filters"
            onAction={() => setFilters({
              q: '',
              world: undefined
            })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">NPCs</h1>
          <p className="text-muted-foreground mt-2">
            Meet the characters you'll encounter in your adventures
          </p>
        </div>
        
        <NPCsFilterBar onFiltersChange={handleFiltersChange} />
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {npcs.length} {npcs.length === 1 ? 'NPC' : 'NPCs'} found
          </p>
        </div>
        
        <CatalogGrid>
          {npcs.map((npc) => (
            <CatalogCard
              key={npc.id}
              entity="npc"
              title={npc.name}
              description={npc.description}
              imageUrl={npc.portrait_url}
              href={`/npcs/${npc.id}`}
              chips={npc.world?.name ? [npc.world.name] : []}
              onClick={() => handleCardClick(npc.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}