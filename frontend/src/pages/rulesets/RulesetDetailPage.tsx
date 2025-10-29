import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { useRulesetQuery, useStoriesQuery } from '@/lib/queries';
import { track } from '@/lib/analytics';
import { ArrowLeft, BookOpen, Zap } from 'lucide-react';

export default function RulesetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: rulesetData, isLoading: rulesetLoading, error: rulesetError } = useRulesetQuery(id || '');
  const ruleset = rulesetData?.data;

  const { data: storiesData, isLoading: storiesLoading } = useStoriesQuery(
    { ruleset: ruleset?.id },
    { enabled: !!ruleset?.id }
  );
  const stories = storiesData?.data || [];

  // Track ruleset view
  useEffect(() => {
    if (ruleset) {
      track('ruleset_view', { ruleset_id: ruleset.id });
    }
  }, [ruleset]);

  const handleCardClick = (entity: string, idOrSlug: string) => {
    track('catalog_card_click', { entity, id_or_slug: idOrSlug });
  };

  if (rulesetLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (rulesetError || !ruleset) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Ruleset Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The ruleset you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/rulesets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rulesets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />
      
      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">{ruleset.name}</h1>
        </div>
        
        {ruleset.description && (
          <p className="text-lg text-muted-foreground max-w-3xl">
            {ruleset.description}
          </p>
        )}
      </div>

      {/* Stories Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Stories Using This Ruleset
          </h2>
          <Badge variant="secondary">
            {stories.length} {stories.length === 1 ? 'Story' : 'Stories'}
          </Badge>
        </div>

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
                imageAlt={story.title}
                title={story.title}
                description={story.short_desc}
                chips={[
                  { label: story.world?.name || 'Unknown World', variant: 'secondary' },
                  ...(story.rulesets?.filter(r => r.id !== ruleset.id).map(r => ({ 
                    label: r.name, 
                    variant: 'outline' 
                  })) || [])
                ]}
                onCardClick={handleCardClick}
              />
            ))}
          </CatalogGrid>
        ) : (
          <EmptyState
            title="No stories yet"
            description={`No stories are currently using the ${ruleset.name} ruleset.`}
            action={
              <Button onClick={() => navigate('/stories')}>
                Browse All Stories
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
