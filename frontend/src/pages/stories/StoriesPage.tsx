import { useEffect } from 'react';
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

interface StoryFilters {
  q: string;
  [key: string]: FilterValue;
}

export default function StoriesPage() {
  const { filters, updateFilters, reset } = useURLFilters<StoryFilters>({
    q: ''
  });

  // Phase 4.10: Use catalog API only - public stories only
  const storiesQuery = useQuery({
    queryKey: ['catalog-stories', filters.q],
    queryFn: async () => {
      const searchParam = filters.q ? `?search=${encodeURIComponent(filters.q)}` : '';
      const response = await fetch(`/api/catalog/stories${searchParam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stories');
      }
      const result = await response.json();
      return result.ok ? (result.data || []) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = storiesQuery.isLoading;
  const error = storiesQuery.error;
  const stories = storiesQuery.data || [];

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
            <h1 className="text-3xl font-bold">Browse Stories</h1>
            <p className="text-muted-foreground mt-2">
              Discover adventures and scenarios to play
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} placeholder="Search stories..." />
          
          <CatalogGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
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
            <h1 className="text-3xl font-bold">Browse Stories</h1>
            <p className="text-muted-foreground mt-2">
              Discover adventures and scenarios to play
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} placeholder="Search stories..." />
          
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
            <h1 className="text-3xl font-bold">Browse Stories</h1>
            <p className="text-muted-foreground mt-2">
              Discover adventures and scenarios to play
            </p>
          </div>
          
          <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} placeholder="Search stories..." />
          
          <EmptyState
            title="No stories found"
            description={
              filters.q
                ? "No stories match your search. Try adjusting your search terms."
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
          <h1 className="text-3xl font-bold">Browse Stories</h1>
          <p className="text-muted-foreground mt-2">
            Discover adventures and scenarios to play
          </p>
        </div>
        
        <WorldsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} placeholder="Search stories..." />
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {stories.length} {stories.length === 1 ? 'story' : 'stories'} found
          </p>
        </div>
        
        <CatalogGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
          {stories.map((story: any) => (
            <CatalogCard
              key={story.id}
              entity="story"
              idOrSlug={story.slug || story.id}
              title={story.title}
              description={story.description || story.synopsis}
              imageUrl={null}
              coverMedia={story.cover_media || null}
              href={`/stories/${story.slug || story.id}`}
              chips={story.tags && story.tags.length > 0 ? [
                ...story.tags.slice(0, 3).map((tag: string) => ({ 
                  label: tag, 
                  variant: 'outline' as const 
                }))
              ] : undefined}
              onCardClick={() => handleCardClick(story.slug || story.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}
