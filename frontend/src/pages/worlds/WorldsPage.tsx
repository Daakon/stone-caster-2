import React, { useEffect } from 'react';
import { useWorldsQuery } from '@/lib/queries';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { WorldsFilterBar } from '@/components/filters/WorldsFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';
import { useURLFilters } from '@/lib/useURLFilters';
import type { FilterValue } from '@/lib/useURLFilters';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty } from '@/lib/meta';

interface WorldFilters {
  q: string;
  [key: string]: FilterValue;
}

export default function WorldsPage() {
  const { filters, updateFilters, reset } = useURLFilters<WorldFilters>({
    q: ''
  });

  // Load worlds with current filters
  const worldsQ: any = useWorldsQuery(filters.q || undefined);
  const isLoading = worldsQ.isLoading;
  const error = worldsQ.error;
  const worlds = Array.isArray(worldsQ?.data)
    ? worldsQ.data
    : (worldsQ?.data?.data ?? []);

  // Track catalog view on mount
  useEffect(() => {
    trackCatalogView('worlds');
  }, []);

  useEffect(() => {
    const title = makeTitle(['Browse Worlds', 'StoneCaster']);
    const desc = makeDescription('Discover worlds that set the stage for your interactive stories.');
    const url = absoluteUrl('/worlds');
    const image = absoluteUrl('/og/world/browse');
    document.title = title;
    upsertMeta('description', desc);
    upsertLink('canonical', url);
    const og = ogTags({ title, description: desc, url, image });
    Object.entries(og).forEach(([k, v]) => upsertProperty(k, v));
    const tw = twitterTags({ title, description: desc, url, image });
    Object.entries(tw).forEach(([k, v]) => upsertMeta(k, v));
  }, []);

  const handleCardClick = (worldId: string) => {
    trackCatalogCardClick('worlds', worldId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Worlds</h1>
            <p className="text-muted-foreground mt-2">
              Explore the rich settings where your adventures take place
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
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
            <h1 className="text-3xl font-bold">Worlds</h1>
            <p className="text-muted-foreground mt-2">
              Explore the rich settings where your adventures take place
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
          <EmptyState
            title="Error loading worlds"
            description="There was a problem loading the worlds. Please try again."
            actionLabel="Refresh page"
            onAction={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (worlds.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Worlds</h1>
            <p className="text-muted-foreground mt-2">
              Explore the rich settings where your adventures take place
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
          <EmptyState
            title="No worlds found"
            description={
              filters.q
                ? "No worlds match your search. Try adjusting your search terms."
                : "No worlds are available at the moment. Check back later for new settings."
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
          <h1 className="text-3xl font-bold">Worlds</h1>
          <p className="text-muted-foreground mt-2">
            Explore the rich settings where your adventures take place
          </p>
        </div>
        
        <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {worlds.length} {worlds.length === 1 ? 'world' : 'worlds'} found
          </p>
        </div>
        
        <CatalogGrid>
          {worlds.map((world) => (
            <CatalogCard
              key={world.id}
              entity="world"
              idOrSlug={world.slug || world.id}
              title={world.name}
              description={world.description}
              imageUrl={world.cover_url}
              href={`/worlds/${world.slug || world.id}`}
              onCardClick={() => handleCardClick(world.slug || world.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}