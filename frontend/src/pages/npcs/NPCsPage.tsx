import React, { useEffect } from 'react';
import { useNPCsQuery } from '@/lib/queries';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { NPCsFilterBar } from '@/components/filters/NPCsFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';
import { useURLFilters } from '@/lib/useURLFilters';
import type { FilterValue } from '@/lib/useURLFilters';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty } from '@/lib/meta';

interface NPCFilters {
  q: string;
  world: string | undefined;
  [key: string]: FilterValue;
}

export default function NPCsPage() {
  const { filters, updateFilters, reset } = useURLFilters<NPCFilters>({
    q: '',
    world: undefined
  });

  // Load NPCs with current filters
  const npcsQ: any = useNPCsQuery({
    q: filters.q || undefined,
    world: filters.world,
  });
  const isLoading = npcsQ.isLoading;
  const error = npcsQ.error;
  const npcs = Array.isArray(npcsQ?.data)
    ? npcsQ.data
    : (npcsQ?.data?.data ?? []);

  // Track catalog view on mount
  useEffect(() => {
    trackCatalogView('npcs');
  }, []);

  useEffect(() => {
    const title = makeTitle(['Browse NPCs', 'StoneCaster']);
    const desc = makeDescription('Meet characters across worlds and stories on StoneCaster.');
    const url = absoluteUrl('/npcs');
    const image = absoluteUrl('/og/npc/browse');
    document.title = title;
    upsertMeta('description', desc);
    upsertLink('canonical', url);
    const og = ogTags({ title, description: desc, url, image });
    Object.entries(og).forEach(([k, v]) => upsertProperty(k, v));
    const tw = twitterTags({ title, description: desc, url, image });
    Object.entries(tw).forEach(([k, v]) => upsertMeta(k, v));
  }, []);

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
          
          <NPCsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
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
          
          <NPCsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
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
          
          <NPCsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
          <EmptyState
            title="No NPCs found"
            description={
              Object.values(filters).some(v => v && v !== '')
                ? "No NPCs match your current filters. Try adjusting your search criteria."
                : "No NPCs are available at the moment. Check back later for new characters."
            }
            actionLabel="Clear filters"
            onAction={reset}
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
        
        <NPCsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
        
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
              idOrSlug={npc.id}
              title={npc.name}
              description={npc.short_desc || npc.description}
              imageUrl={npc.portrait_url}
              href={`/npcs/${npc.id}`}
              chips={npc.world?.name ? [{ label: npc.world.name, variant: 'secondary' as const }] : undefined}
              onCardClick={() => handleCardClick(npc.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}