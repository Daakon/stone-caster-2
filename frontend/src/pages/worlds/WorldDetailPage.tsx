import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { useWorldQuery, useStoriesQuery, useNPCsQuery } from '@/lib/queries';
import { track } from '@/lib/analytics';
import { ExternalLink, Users, BookOpen } from 'lucide-react';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty, injectJSONLD } from '@/lib/meta';

export default function WorldDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'stories' | 'npcs'>('stories');

  const { data: worldData, isLoading: worldLoading, error: worldError } = useWorldQuery(slug || '');
  const world = worldData?.data;

  const { data: storiesData, isLoading: storiesLoading } = useStoriesQuery(
    { world: world?.id },
    { enabled: !!world?.id }
  );
  const stories = storiesData?.data || [];

  const { data: npcsData, isLoading: npcsLoading } = useNPCsQuery(
    { world: world?.id },
    { enabled: !!world?.id }
  );
  const npcs = npcsData?.data || [];

  // Track world view
  useEffect(() => {
    if (world) {
      track('world_view', { world_slug: slug });
    }
  }, [world, slug]);

  // Track tab changes
  const handleTabChange = (value: string) => {
    const newTab = value as 'stories' | 'npcs';
    setActiveTab(newTab);
    if (world) {
      track('world_tab', { world_slug: slug, tab: newTab });
    }
  };

  const handleCardClick = (entity: string, idOrSlug: string) => {
    track('catalog_card_click', { entity, id_or_slug: idOrSlug });
  };

  if (worldLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="space-y-6">
          <div className="aspect-video bg-muted animate-pulse rounded-lg" />
          <div className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (worldError || !world) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <EmptyState
          title="World not found"
          description="The world you're looking for doesn't exist or has been removed."
          action={
            <Button onClick={() => navigate('/worlds')}>
              Browse Worlds
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />
      
      {/* Hero Section */}
      <div className="mb-8">
        {world.cover_url && (
          <div className="aspect-video overflow-hidden rounded-lg mb-6">
            <img
              src={world.cover_url}
              alt={world.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">{world.name}</h1>
          {world.description && (
            <p className="text-lg text-muted-foreground max-w-3xl">
              {world.description}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stories" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Stories ({stories.length})
          </TabsTrigger>
          <TabsTrigger value="npcs" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            NPCs ({npcs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stories" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Stories in {world.name}</h2>
            {storiesLoading ? (
              <CatalogGrid>
                {Array.from({ length: 6 }).map((_, i) => (
                  <CatalogSkeleton key={i} />
                ))}
              </CatalogGrid>
            ) : stories.length > 0 ? (
              <CatalogGrid>
                {stories.map((story) => (
                  <CatalogCard
                    key={story.id}
                    entity="story"
                    idOrSlug={story.slug || story.id}
                    href={`/stories/${story.slug || story.id}`}
                    imageUrl={story.hero_url}
                    title={story.title}
                    description={story.short_desc}
                    chips={[
                      { label: story.world?.name || 'Unknown World', variant: 'secondary' },
                      ...(story.rulesets?.map(r => ({ label: r.name, variant: 'outline' as const })) || [])
                    ]}
                    onCardClick={handleCardClick}
                  />
                ))}
              </CatalogGrid>
            ) : (
              <EmptyState
                title="No stories yet"
                description={`There are no stories set in ${world.name} yet.`}
                action={
                  <Button onClick={() => navigate('/stories')}>
                    Browse All Stories
                  </Button>
                }
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="npcs" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">NPCs in {world.name}</h2>
            {npcsLoading ? (
              <CatalogGrid>
                {Array.from({ length: 6 }).map((_, i) => (
                  <CatalogSkeleton key={i} />
                ))}
              </CatalogGrid>
            ) : npcs.length > 0 ? (
              <CatalogGrid>
                {npcs.map((npc) => (
                  <CatalogCard
                    key={npc.id}
                    entity="npc"
                    idOrSlug={npc.id}
                    href={`/npcs/${npc.id}`}
                    imageUrl={npc.portrait_url}
                    imageAlt={npc.name}
                    title={npc.name}
                    description={npc.short_desc}
                    chips={[
                      { label: world.name, variant: 'secondary' }
                    ]}
                    onCardClick={handleCardClick}
                  />
                ))}
              </CatalogGrid>
            ) : (
              <EmptyState
                title="No NPCs yet"
                description={`There are no NPCs in ${world.name} yet.`}
                action={
                  <Button onClick={() => navigate('/npcs')}>
                    Browse All NPCs
                  </Button>
                }
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
