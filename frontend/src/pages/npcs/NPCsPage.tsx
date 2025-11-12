import React, { useEffect, useState, useMemo } from 'react';
import { useNPCsQuery, useMyNPCsQuery } from '@/lib/queries';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { NPCsFilterBar } from '@/components/filters/NPCsFilterBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';
import { useURLFilters } from '@/lib/useURLFilters';
import type { FilterValue } from '@/lib/useURLFilters';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty } from '@/lib/meta';
import { useAuthStore } from '@/store/auth';
import { Lock } from 'lucide-react';

interface NPCFilters {
  q: string;
  world: string | undefined;
  tags?: string[];
  [key: string]: FilterValue;
}

export default function NPCsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');
  const { filters, updateFilters, reset } = useURLFilters<NPCFilters>({
    q: '',
    world: undefined,
    tags: undefined,
  });

  // Public NPCs query (cached)
  const publicNPCsQ: any = useNPCsQuery({
    q: filters.q || undefined,
    world: filters.world,
  });

  // My NPCs query (only enabled when authenticated and on "my" tab)
  const myNPCsQ: any = useMyNPCsQuery(
    {
      q: filters.q || undefined,
      world: filters.world,
    },
    activeTab === 'my' && !!user // Enable only when on "my" tab and user is authenticated
  );

  // Parse public NPCs response
  const publicNPCs = useMemo(() => {
    if (!publicNPCsQ?.data) return [];
    if (Array.isArray(publicNPCsQ.data)) return publicNPCsQ.data;
    if (publicNPCsQ.data.ok && publicNPCsQ.data.data) {
      const responseData = publicNPCsQ.data.data;
      if (responseData.items && Array.isArray(responseData.items)) {
        return responseData.items;
      }
      if (Array.isArray(responseData)) return responseData;
    }
    if (publicNPCsQ.data.data) {
      const innerData = publicNPCsQ.data.data;
      if (innerData.items && Array.isArray(innerData.items)) {
        return innerData.items;
      }
      if (Array.isArray(innerData)) return innerData;
    }
    return [];
  }, [publicNPCsQ?.data]);

  // Parse my NPCs response
  const myNPCs = useMemo(() => {
    if (!myNPCsQ?.data) return [];
    if (Array.isArray(myNPCsQ.data)) return myNPCsQ.data;
    if (myNPCsQ.data.items && Array.isArray(myNPCsQ.data.items)) {
      return myNPCsQ.data.items;
    }
    if (Array.isArray(myNPCsQ.data)) return myNPCsQ.data;
    return [];
  }, [myNPCsQ?.data]);

  // Filter public NPCs by tags if provided
  const filteredPublicNPCs = useMemo(() => {
    if (!filters.tags || filters.tags.length === 0) {
      return publicNPCs;
    }
    return publicNPCs.filter((npc: any) => {
      const npcTags = npc.tags || npc.roleTags || npc.doc?.tags || [];
      return filters.tags!.some(tag => npcTags.includes(tag));
    });
  }, [publicNPCs, filters.tags]);

  // Get all unique tags from public NPCs for filtering
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    publicNPCs.forEach((npc: any) => {
      const npcTags = npc.tags || npc.roleTags || npc.doc?.tags || [];
      npcTags.forEach((tag: string) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [publicNPCs]);

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

  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    updateFilters({ tags: newTags.length > 0 ? newTags : undefined });
  };

  const isLoading = activeTab === 'public' ? publicNPCsQ.isLoading : myNPCsQ.isLoading;
  const error = activeTab === 'public' ? publicNPCsQ.error : myNPCsQ.error;
  const currentNPCs = activeTab === 'public' ? filteredPublicNPCs : myNPCs;
  const isUnauthorized = activeTab === 'my' && !user;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">NPCs</h1>
          <p className="text-muted-foreground mt-2">
            Meet the characters you'll encounter in your adventures
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'public' | 'my')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="public">Public NPCs</TabsTrigger>
            <TabsTrigger value="my" disabled={!user}>
              My NPCs {user && <Lock className="ml-2 h-3 w-3" />}
            </TabsTrigger>
          </TabsList>

          {/* Public NPCs Tab */}
          <TabsContent value="public" className="space-y-6 mt-6">
            <NPCsFilterBar 
              filters={filters} 
              updateFilters={updateFilters} 
              reset={reset}
              availableTags={availableTags}
              selectedTags={filters.tags || []}
              onTagToggle={handleTagToggle}
            />

            {isLoading && (
              <CatalogGrid>
                {Array.from({ length: 6 }).map((_, index) => (
                  <CatalogSkeleton key={index} />
                ))}
              </CatalogGrid>
            )}

            {!isLoading && error && (
              <EmptyState
                title="Error loading NPCs"
                description="There was a problem loading the NPCs. Please try again."
                actionLabel="Refresh page"
                onAction={() => window.location.reload()}
              />
            )}

            {!isLoading && !error && currentNPCs.length === 0 && (
              <EmptyState
                title="No NPCs found"
                description={
                  Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : v !== ''))
                    ? "No NPCs match your current filters. Try adjusting your search criteria."
                    : "No public NPCs are available at the moment. Check back later for new characters."
                }
                actionLabel="Clear filters"
                onAction={reset}
              />
            )}

            {!isLoading && !error && currentNPCs.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {currentNPCs.length} {currentNPCs.length === 1 ? 'NPC' : 'NPCs'} found
                  </p>
                </div>
                
                <CatalogGrid>
                  {currentNPCs.map((npc: any) => (
                    <CatalogCard
                      key={npc.id}
                      entity="npc"
                      idOrSlug={npc.id}
                      title={npc.name}
                      description={npc.short_desc || npc.description}
                      imageUrl={npc.portrait_url || npc.portraitUrl}
                      href={`/npcs/${npc.id}`}
                      chips={[
                        ...(npc.world?.name ? [{ label: npc.world.name, variant: 'secondary' as const }] : []),
                        ...((npc.tags || npc.roleTags || npc.doc?.tags || []).slice(0, 2).map((tag: string) => ({ 
                          label: tag, 
                          variant: 'outline' as const 
                        }))),
                      ]}
                      onCardClick={() => handleCardClick(npc.id)}
                    />
                  ))}
                </CatalogGrid>
              </>
            )}
          </TabsContent>

          {/* My NPCs Tab */}
          <TabsContent value="my" className="space-y-6 mt-6">
            {isUnauthorized && (
              <EmptyState
                title="Sign in required"
                description="Sign in to view and manage your private NPCs."
                actionLabel="Sign In"
                onAction={() => window.location.href = '/auth/signin'}
              />
            )}

            {!isUnauthorized && (
              <>
                <NPCsFilterBar 
                  filters={filters} 
                  updateFilters={updateFilters} 
                  reset={reset}
                />

                {isLoading && (
                  <CatalogGrid>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <CatalogSkeleton key={index} />
                    ))}
                  </CatalogGrid>
                )}

                {!isLoading && error && (
                  <EmptyState
                    title="Error loading your NPCs"
                    description="There was a problem loading your NPCs. Please try again."
                    actionLabel="Refresh page"
                    onAction={() => window.location.reload()}
                  />
                )}

                {!isLoading && !error && currentNPCs.length === 0 && (
                  <EmptyState
                    title="No private NPCs yet"
                    description={
                      Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : v !== ''))
                        ? "No NPCs match your current filters. Try adjusting your search criteria."
                        : "You haven't created any private NPCs yet. Create one from the admin panel."
                    }
                    actionLabel="Clear filters"
                    onAction={reset}
                  />
                )}

                {!isLoading && !error && currentNPCs.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {currentNPCs.length} {currentNPCs.length === 1 ? 'private NPC' : 'private NPCs'}
                      </p>
                    </div>
                    
                    <CatalogGrid>
                      {currentNPCs.map((npc: any) => (
                        <CatalogCard
                          key={npc.id}
                          entity="npc"
                          idOrSlug={npc.id}
                          title={npc.name}
                          description={npc.short_desc || npc.description}
                          imageUrl={npc.portrait_url || npc.portraitUrl}
                          href={`/npcs/${npc.id}`}
                      chips={[
                        { label: 'Private', variant: 'secondary' as const },
                        ...(npc.world?.name ? [{ label: npc.world.name, variant: 'outline' as const }] : []),
                        ...(npc.status ? [{ label: npc.status, variant: 'outline' as const }] : []),
                      ]}
                          onCardClick={() => handleCardClick(npc.id)}
                        />
                      ))}
                    </CatalogGrid>
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
