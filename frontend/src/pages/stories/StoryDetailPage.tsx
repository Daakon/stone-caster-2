import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { WorldRuleMeters } from '@/components/gameplay/WorldRuleMeters';
import { StoneCost } from '@/components/gameplay/StoneCost';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { useStoryQuery } from '@/lib/queries';
import { track } from '@/lib/analytics';
import { 
  Gem, 
  Users, 
  Zap, 
  ExternalLink, 
  Star,
  Clock,
  Shield,
  Eye,
  Play,
} from 'lucide-react';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty, injectJSONLD } from '@/lib/meta';

export default function StoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: storyData, isLoading, error } = useStoryQuery(id || '');
  const story = storyData?.data;

  // Track story view and update document head for SEO
  // MUST be called before any early returns to satisfy Rules of Hooks
  useEffect(() => {
    if (!storyData || !('data' in storyData) || !storyData.data) return;
    const storyDetail = storyData.data;
    const title = makeTitle([storyDetail.title, storyDetail.world_name ?? storyDetail.world ?? 'World', 'StoneCaster']);
    const desc = makeDescription(storyDetail.short_desc || storyDetail.description || 'Play an interactive story on StoneCaster.');
    const url = absoluteUrl(`/stories/${storyDetail.slug}`);
    const image = absoluteUrl(`/og/story/${storyDetail.slug}`);

    document.title = title;
    upsertMeta('description', desc);
    upsertLink('canonical', url);

    const og = ogTags({ title, description: desc, url, image });
    Object.entries(og).forEach(([k, v]) => upsertProperty(k, v));
    const tw = twitterTags({ title, description: desc, url, image });
    Object.entries(tw).forEach(([k, v]) => upsertMeta(k, v));

    injectJSONLD({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: storyDetail.title,
      author: 'StoneCaster',
      genre: 'Interactive Story',
      isPartOf: { '@type': 'CreativeWorkSeries', name: storyDetail.world_name ?? storyDetail.world ?? 'World' },
      url,
    });
  }, [storyData]);
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Story...</h1>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Story Not Found</h1>
          <Button onClick={() => navigate('/stories')}>
            Back to Stories
          </Button>
        </div>
      </div>
    );
  }

  const handleStartStory = () => {
    track('begin_story_click', { story_id: story.id });
    navigate(`/stories/${story.id}/characters`);
  };

  const handleLearnAboutWorld = () => {
    if (story.world) {
      navigate(`/worlds/${story.world.id}`);
    }
  };

  const differentiatorIcons = {
    relationships: Users,
    factions: Shield,
    npcAgency: Eye,
    worldRules: Zap
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Section */}
          <Card>
            <CardHeader className="p-0">
              <div className="relative overflow-hidden rounded-t-lg">
                <img
                  src={story.hero_url || '/placeholder-hero.jpg'}
                  alt={story.title}
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-4 right-4">
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    <Star className="h-3 w-3 mr-1" />
                    {story.kind}
                  </Badge>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h1 className="text-3xl font-bold text-white mb-2">{story.title}</h1>
                  <p className="text-lg text-white/90">{story.short_desc}</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Gem className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    <StoneCost cost={5} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">~2-4 hours</span>
                </div>
              </div>

              {/* Chips Section */}
              <div className="space-y-4 mb-6">
                {/* World and Ruleset Chips */}
                <div className="flex flex-wrap gap-2">
                  {story.world && (
                    <Badge 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => navigate(`/worlds/${story.world.slug || story.world.id}`)}
                      aria-label={`View world ${story.world.name}`}
                    >
                      {story.world.name}
                    </Badge>
                  )}
                  {story.rulesets?.map((ruleset) => (
                    <Badge 
                      key={ruleset.id}
                      variant="outline" 
                      className="cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/rulesets/${ruleset.id}`)}
                      aria-label={`View ruleset ${ruleset.name}`}
                    >
                      {ruleset.name}
                    </Badge>
                  ))}
                </div>
                
                {/* Tags */}
                {story.tags && story.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {story.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-muted-foreground leading-relaxed">
                {story.short_desc}
              </p>

              {/* Start Story Button */}
              <div className="mt-6 pt-6 border-t">
                <Button
                  onClick={handleStartStory}
                  size="lg"
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Story
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* World Rules */}
          {story.world && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  World Rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">World rules will be displayed here</p>
              </CardContent>
            </Card>
          )}

          {/* Differentiators */}
          {story.rulesets && story.rulesets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>What Makes This World Unique</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {story.rulesets.map((ruleset) => (
                    <div key={ruleset.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Zap className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium mb-1">{ruleset.name}</h4>
                        <p className="text-sm text-muted-foreground">{ruleset.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Featured NPCs */}
          {story.featured_npcs && story.featured_npcs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Featured NPCs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CatalogGrid>
                  {story.featured_npcs.map((npc) => (
                    <CatalogCard
                      key={npc.id}
                      entity="npc"
                      idOrSlug={npc.id}
                      href={`/npcs/${npc.id}`}
                      imageUrl={npc.portrait_url}
                      title={npc.name}
                      description={npc.short_desc}
                      chips={[
                        { label: story.world?.name || 'Unknown World', variant: 'secondary' as const }
                      ]}
                      onCardClick={(entity, idOrSlug) => track('catalog_card_click', { entity, id_or_slug: idOrSlug })}
                    />
                  ))}
                </CatalogGrid>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Action Card */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Ready to Begin?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start your story in {story.world?.name || 'this world'}
                  </p>
                </div>

                <Button
                  onClick={handleStartStory}
                  className="w-full"
                  size="lg"
                >
                  Begin Story
                </Button>

                <Separator />

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleLearnAboutWorld}
                    className="w-full"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Learn About {story.world?.name || 'World'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* World Info */}
          {story.world && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">World: {story.world.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {story.world.description || 'Explore this world'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {story.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
