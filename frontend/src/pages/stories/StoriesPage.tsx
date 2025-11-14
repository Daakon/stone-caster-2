import React, { useEffect } from 'react';
import { useStories } from '@/lib/queries/index';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { StoriesFilterBar } from '@/components/filters/StoriesFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';
import { useURLFilters } from '@/lib/useURLFilters';
import type { FilterValue } from '@/lib/useURLFilters';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty } from '@/lib/meta';

interface StoryFilters {
  q: string;
  world: string | undefined;
  kind: string | undefined;
  ruleset: string | undefined;
  tags: string[];
  [key: string]: FilterValue;
}

export default function StoriesPage() {
  const { filters, updateFilters, reset } = useURLFilters<StoryFilters>({
    q: '',
    world: undefined,
    kind: undefined,
    ruleset: undefined,
    tags: []
  });

  // Load stories with current filters - using canonical hook
  const { data: stories = [], isLoading, error } = useStories({
    worldId: filters.world,
    filter: filters.q || undefined,
    kind: filters.kind as 'scenario' | 'adventure' | undefined,
    ruleset: filters.ruleset,
    tags: filters.tags.length > 0 ? filters.tags : undefined,
  });

  // Track catalog view on mount
  useEffect(() => {
    trackCatalogView('stories');
  }, []);

  useEffect(() => {
    const title = makeTitle(['Browse Stories', 'StoneCaster']);
    const desc = makeDescription('Explore active stories and begin your next adventure.');
    const url = absoluteUrl('/stories');
    const image = absoluteUrl('/og/story/browse');
    document.title = title;
    upsertMeta('description', desc);
    upsertLink('canonical', url);
    const og = ogTags({ title, description: desc, url, image });
    Object.entries(og).forEach(([k, v]) => upsertProperty(k, v));
    const tw = twitterTags({ title, description: desc, url, image });
    Object.entries(tw).forEach(([k, v]) => upsertMeta(k, v));
  }, []);

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
          
          <StoriesFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
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
          
          <StoriesFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
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
          
          <StoriesFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
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
          <h1 className="text-3xl font-bold">Stories</h1>
          <p className="text-muted-foreground mt-2">
            Discover adventures and scenarios to play
          </p>
        </div>
        
        <StoriesFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
        
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
              idOrSlug={story.slug || story.id}
              title={story.title}
              description={story.short_desc}
              imageUrl={story.hero_url}
              coverMedia={story.cover_media || null}
              href={`/stories/${story.slug || story.id}`}
              chips={story.world?.name || story.rulesets?.length ? [
                story.world?.name,
                ...(story.rulesets?.map(r => ({ label: r.name, variant: 'outline' as const })) || [])
              ].filter(Boolean) : undefined}
              onCardClick={() => handleCardClick(story.slug || story.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}