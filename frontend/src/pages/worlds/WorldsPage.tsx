import React, { useState, useEffect } from 'react';
import { useWorldsQuery } from '@/lib/queries';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { WorldsFilterBar } from '@/components/filters/WorldsFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';

interface WorldFilters {
  q: string;
}

export default function WorldsPage() {
  const [filters, setFilters] = useState<WorldFilters>({
    q: ''
  });

  // Load worlds with current filters
  const { data: worldsData, isLoading, error } = useWorldsQuery(filters.q || undefined);

  const worlds = worldsData || [];

  // Track catalog view on mount
  useEffect(() => {
    trackCatalogView('worlds');
  }, []);

  const handleFiltersChange = (newFilters: WorldFilters) => {
    setFilters(newFilters);
  };

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
          
          <WorldsFilterBar onFiltersChange={handleFiltersChange} />
          
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
          
          <WorldsFilterBar onFiltersChange={handleFiltersChange} />
          
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
          
          <WorldsFilterBar onFiltersChange={handleFiltersChange} />
          
          <EmptyState
            title="No worlds found"
            description={
              filters.q
                ? "No worlds match your search. Try adjusting your search terms."
                : "No worlds are available at the moment. Check back later for new settings."
            }
            actionLabel="Clear filters"
            onAction={() => setFilters({ q: '' })}
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
        
        <WorldsFilterBar onFiltersChange={handleFiltersChange} />
        
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
              title={world.name}
              description={world.description}
              imageUrl={world.cover_url}
              href={`/worlds/${world.slug || world.id}`}
              onClick={() => handleCardClick(world.slug || world.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}