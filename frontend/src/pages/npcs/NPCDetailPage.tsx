import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { useNPCQuery } from '@/lib/queries';
import { track } from '@/lib/analytics';
import { ExternalLink, Users, ArrowLeft } from 'lucide-react';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty, injectJSONLD } from '@/lib/meta';

export default function NPCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: npcData, isLoading, error } = useNPCQuery(id || '');
  const npc = npcData?.data;

  // Track NPC view
  useEffect(() => {
    if (npc) {
      track('npc_view', { npc_id: npc.id, world_id: npc.world_id });
    }
  }, [npc]);

  useEffect(() => {
    if (!npcData || !('data' in npcData) || !npcData.data) return;
    const npc = npcData.data;
    const title = makeTitle([`${npc.name} of ${npc.world_name ?? 'World'}`, 'StoneCaster']);
    const desc = makeDescription(npc.short_desc || npc.bio || 'Meet a character from StoneCaster.');
    const url = absoluteUrl(`/npcs/${npc.id}`);
    const image = absoluteUrl(`/og/npc/${npc.id}`);

    document.title = title;
    upsertMeta('description', desc);
    upsertLink('canonical', url);

    const og = ogTags({ title, description: desc, url, image });
    Object.entries(og).forEach(([k, v]) => upsertProperty(k, v));
    const tw = twitterTags({ title, description: desc, url, image });
    Object.entries(tw).forEach(([k, v]) => upsertMeta(k, v));

    injectJSONLD({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: npc.name,
      description: desc,
      url,
      isPartOf: npc.world_name ? { '@type': 'CreativeWorkSeries', name: npc.world_name } : undefined,
    });
  }, [npcData]);

  const handleViewStories = () => {
    if (npc) {
      track('cross_link_click', { 
        from: 'npc', 
        to: 'stories', 
        world_id: npc.world_id, 
        q: npc.name 
      });
      navigate(`/stories?world=${npc.world_id}&q=${encodeURIComponent(npc.name)}`);
    }
  };

  const handleWorldClick = () => {
    if (npc?.world) {
      navigate(`/worlds/${npc.world.slug || npc.world.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 bg-muted animate-pulse rounded-full" />
            <div className="space-y-2">
              <div className="h-8 bg-muted animate-pulse rounded w-48" />
              <div className="h-4 bg-muted animate-pulse rounded w-32" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-4 bg-muted animate-pulse rounded w-full" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !npc) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">NPC Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The NPC you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/npcs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to NPCs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Section */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {npc.portrait_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={npc.portrait_url}
                      alt={npc.name}
                      className="w-24 h-24 rounded-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{npc.name}</h1>
                    {npc.world && (
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-secondary/80 transition-colors"
                        onClick={handleWorldClick}
                        aria-label={`View world ${npc.world.name}`}
                      >
                        {npc.world.name}
                      </Badge>
                    )}
                  </div>
                  
                  {npc.short_desc && (
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      {npc.short_desc}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {npc.description && (
            <Card>
              <CardHeader>
                <CardTitle>About {npc.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {npc.description}
                </p>
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
                  <h3 className="text-lg font-semibold mb-2">Explore Stories</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Find stories featuring {npc.name} in {npc.world?.name || 'their world'}
                  </p>
                </div>

                <Button
                  onClick={handleViewStories}
                  className="w-full"
                  size="lg"
                >
                  <Users className="h-4 w-4 mr-2" />
                  View Stories with {npc.name}
                </Button>

                {npc.world && (
                  <Button
                    variant="outline"
                    onClick={handleWorldClick}
                    className="w-full"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Explore {npc.world.name}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* World Info */}
          {npc.world && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">World: {npc.world.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {npc.world.description || 'Explore this world'}
                </p>
                <Button
                  variant="outline"
                  onClick={handleWorldClick}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Learn About {npc.world.name}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
