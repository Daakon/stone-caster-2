import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { WorldsFilterBar } from '@/components/filters/WorldsFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';
import { useURLFilters } from '@/lib/useURLFilters';
import type { FilterValue } from '@/lib/useURLFilters';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty } from '@/lib/meta';

interface NPCFilters {
  q: string;
  [key: string]: FilterValue;
}

export default function NPCsPage() {
  const { filters, updateFilters, reset } = useURLFilters<NPCFilters>({
    q: ''
  });

  // Phase 4.10: Use catalog API only - public NPCs only
  const npcsQuery = useQuery({
    queryKey: ['catalog-npcs', filters.q],
    queryFn: async () => {
      const searchParam = filters.q ? `?q=${encodeURIComponent(filters.q)}` : '';
      const response = await fetch(`/api/catalog/npcs${searchParam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch NPCs');
      }
      const result = await response.json();
      return result.ok ? (result.data.items || result.data || []) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = npcsQuery.isLoading;
  const error = npcsQuery.error;
  const npcs = npcsQuery.data || [];

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
            <h1 className="text-3xl font-bold">Browse NPCs</h1>
            <p className="text-muted-foreground mt-2">
              Meet the characters you'll encounter in your adventures
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} placeholder="Search NPCs..." />
          
          <CatalogGrid columns={{ mobile: 2, tablet: 3, desktop: 4 }}>
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
            <h1 className="text-3xl font-bold">Browse NPCs</h1>
            <p className="text-muted-foreground mt-2">
              Meet the characters you'll encounter in your adventures
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} placeholder="Search NPCs..." />
          
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
            <h1 className="text-3xl font-bold">Browse NPCs</h1>
            <p className="text-muted-foreground mt-2">
              Meet the characters you'll encounter in your adventures
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} placeholder="Search NPCs..." />
          
          <EmptyState
            title="No NPCs found"
            description={
              filters.q
                ? "No NPCs match your search. Try adjusting your search terms."
                : "No public NPCs are available at the moment. Check back later for new characters."
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
          <h1 className="text-3xl font-bold">Browse NPCs</h1>
          <p className="text-muted-foreground mt-2">
            Meet the characters you'll encounter in your adventures
          </p>
        </div>
        
        <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} placeholder="Search NPCs..." />
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {npcs.length} {npcs.length === 1 ? 'NPC' : 'NPCs'} found
          </p>
        </div>
        
        <CatalogGrid columns={{ mobile: 2, tablet: 3, desktop: 4 }}>
          {npcs.map((npc: any) => (
            <CatalogCard
              key={npc.id}
              entity="npc"
              idOrSlug={npc.slug || npc.id}
              title={npc.name}
              description={npc.description}
              imageUrl={npc.portraitUrl}
              coverMedia={npc.cover_media || null}
              href={`/npcs/${npc.slug || npc.id}`}
              chips={[
                ...(npc.roleTags && npc.roleTags.length > 0 
                  ? npc.roleTags.slice(0, 2).map((tag: string) => ({ 
                      label: tag, 
                      variant: 'outline' as const 
                    }))
                  : []
                ),
              ]}
              onCardClick={() => handleCardClick(npc.slug || npc.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}
