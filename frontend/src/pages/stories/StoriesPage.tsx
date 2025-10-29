import React, { useState, useEffect } from 'react';
import { useStoriesQuery } from '@/lib/queries';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { StoriesFilterBar } from '@/components/filters/StoriesFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';

interface StoryFilters {
  q: string;
  world: string | undefined;
  kind: string | undefined;
  ruleset: string | undefined;
  tags: string[];
}

export default function StoriesPage() {
  const [filters, setFilters] = useState<StoryFilters>({
    q: '',
    world: undefined,
    kind: undefined,
    ruleset: undefined,
    tags: []
  });

  // Load stories with current filters
  const { data: storiesData, isLoading, error } = useStoriesQuery({
    q: filters.q || undefined,
    world: filters.world,
    kind: filters.kind as any,
    ruleset: filters.ruleset,
    tags: filters.tags.length > 0 ? filters.tags : undefined,
  });

  const stories = storiesData || [];

  // Track catalog view on mount
  useEffect(() => {
    trackCatalogView('stories');
  }, []);

  const handleFiltersChange = (newFilters: StoryFilters) => {
    setFilters(newFilters);
  };

  const handleCardClick = (storyId: string) => {
    trackCatalogCardClick('stories', storyId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Stories</h1>
            <p className="text-muted-foreground mt-2">
              Discover adventures and scenarios to play
            </p>
          </div>
          
          <StoriesFilterBar onFiltersChange={handleFiltersChange} />
          
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
            <h1 className="text-3xl font-bold">Stories</h1>
            <p className="text-muted-foreground mt-2">
              Discover adventures and scenarios to play
            </p>
          </div>
          
          <StoriesFilterBar onFiltersChange={handleFiltersChange} />
          
          <EmptyState
            title="Error loading stories"
            description="There was a problem loading the stories. Please try again."
            actionLabel="Refresh page"
            onAction={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Stories</h1>
            <p className="text-muted-foreground mt-2">
              Discover adventures and scenarios to play
            </p>
          </div>
          
          <StoriesFilterBar onFiltersChange={handleFiltersChange} />
          
          <EmptyState
            title="No stories found"
            description={
              Object.values(filters).some(v => 
                Array.isArray(v) ? v.length > 0 : v && v !== ''
              )
                ? "No stories match your current filters. Try adjusting your search criteria."
                : "No stories are available at the moment. Check back later for new adventures."
            }
            actionLabel="Clear filters"
            onAction={() => setFilters({
              q: '',
              world: undefined,
              kind: undefined,
              ruleset: undefined,
              tags: []
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
          <h1 className="text-3xl font-bold">Stories</h1>
          <p className="text-muted-foreground mt-2">
            Discover adventures and scenarios to play
          </p>
        </div>
        
        <StoriesFilterBar onFiltersChange={handleFiltersChange} />
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {stories.length} {stories.length === 1 ? 'story' : 'stories'} found
          </p>
        </div>
        
        <CatalogGrid>
          {stories.map((story) => (
            <CatalogCard
              key={story.id}
              entity="story"
              title={story.title}
              description={story.short_desc || story.description}
              imageUrl={story.hero_url}
              href={`/stories/${story.slug || story.id}`}
              chips={[
                story.world?.name,
                ...(story.rulesets?.map(r => r.name) || [])
              ].filter(Boolean)}
              onClick={() => handleCardClick(story.slug || story.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}