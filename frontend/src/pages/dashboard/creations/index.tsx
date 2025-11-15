/**
 * My Creations Dashboard
 * Lists user's created worlds
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraWorldsService } from '@/services/chimera.worlds';
import { chimeraEntitiesService } from '@/services/chimera.entities';
import { chimeraStoriesService } from '@/services/chimera.stories';
import { chimeraPacksService } from '@/services/chimera.packs';
import { chimeraLoreService } from '@/services/chimera.lore';

const VISIBILITY_COLORS = {
  private: 'secondary',
  pending_approval: 'default',
  public: 'default',
} as const;

const VALID_TABS = ['worlds', 'entities', 'stories', 'lore', 'packs'] as const;
type TabValue = typeof VALID_TABS[number];

export default function MyCreationsDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tab } = useParams<{ tab: string }>();
  
  // Validate tab from route parameter
  const validTab = (tab && VALID_TABS.includes(tab as TabValue)) ? (tab as TabValue) : null;
  
  // Redirect to default tab if invalid
  if (!validTab) {
    return <Navigate to="/dashboard/creations/worlds" replace />;
  }
  
  const [activeTab, setActiveTab] = useState<TabValue>(validTab);
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null);
  const [deletingEntityId, setDeletingEntityId] = useState<string | null>(null);
  const [deletingPackId, setDeletingPackId] = useState<string | null>(null);
  const [deletingLoreId, setDeletingLoreId] = useState<string | null>(null);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);

  // Sync activeTab with route parameter when it changes (e.g., browser back/forward)
  useEffect(() => {
    if (validTab && validTab !== activeTab) {
      setActiveTab(validTab);
    }
  }, [validTab, activeTab]);

  // Handle tab changes - navigate to new route when tab changes
  const handleTabChange = (value: string) => {
    const newTab = value as TabValue;
    if (VALID_TABS.includes(newTab)) {
      navigate(`/dashboard/creations/${newTab}`, { replace: false });
    }
  };

  const { data: worlds, isLoading: isLoadingWorlds, error: worldsError } = useQuery({
    queryKey: ['chimera-my-worlds'],
    queryFn: () => chimeraWorldsService.getMyWorlds(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: entities, isLoading: isLoadingEntities, error: entitiesError } = useQuery({
    queryKey: ['chimera-my-entities'],
    queryFn: () => chimeraEntitiesService.getMyEntities(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: stories, isLoading: isLoadingStories, error: storiesError } = useQuery({
    queryKey: ['chimera-my-stories'],
    queryFn: () => chimeraStoriesService.getMyStories(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: packs, isLoading: isLoadingPacks, error: packsError } = useQuery({
    queryKey: ['chimera-my-packs'],
    queryFn: () => chimeraPacksService.getMyPacks(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: lore, isLoading: isLoadingLore, error: loreError } = useQuery({
    queryKey: ['chimera-my-lore'],
    queryFn: () => chimeraLoreService.getMyLore(),
    staleTime: 30 * 1000, // 30 seconds
  });


  const ENTITY_TYPE_COLORS = {
    NPC: 'default',
    ITEM: 'secondary',
    FACTION: 'outline',
  } as const;

  const handleDeleteWorld = async (id: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingWorldId(id);
    try {
      await chimeraWorldsService.deleteWorld(id);
      toast.success('World deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-worlds'] });
    } catch (error) {
      console.error('Error deleting world:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete world');
    } finally {
      setDeletingWorldId(null);
    }
  };

  const handleDeleteEntity = async (id: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingEntityId(id);
    try {
      await chimeraEntitiesService.deleteEntity(id);
      toast.success('Entity deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-entities'] });
    } catch (error) {
      console.error('Error deleting entity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete entity');
    } finally {
      setDeletingEntityId(null);
    }
  };

  const handleDeletePack = async (id: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingPackId(id);
    try {
      await chimeraPacksService.deletePack(id);
      toast.success('Content pack deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-packs'] });
    } catch (error) {
      console.error('Error deleting pack:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete pack');
    } finally {
      setDeletingPackId(null);
    }
  };

  const handleDeleteLore = async (id: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingLoreId(id);
    try {
      await chimeraLoreService.deleteLore(id);
      toast.success('Lore template deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-lore'] });
    } catch (error) {
      console.error('Error deleting lore:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete lore template');
    } finally {
      setDeletingLoreId(null);
    }
  };

  const handleDeleteStory = async (id: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingStoryId(id);
    try {
      await chimeraStoriesService.deleteStory(id);
      toast.success('Story deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-stories'] });
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete story');
    } finally {
      setDeletingStoryId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Creations</h1>
          <p className="text-muted-foreground mt-2">
            Manage your created worlds and entities
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="worlds">Worlds</TabsTrigger>
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="stories">Stories</TabsTrigger>
          <TabsTrigger value="lore">Lore</TabsTrigger>
          <TabsTrigger value="packs">Content Packs</TabsTrigger>
        </TabsList>

        <TabsContent value="worlds" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Worlds</CardTitle>
                  <CardDescription>
                    {worlds?.length || 0} world{worlds?.length !== 1 ? 's' : ''} found
                  </CardDescription>
                </div>
                <Button asChild>
                  <Link to="/dashboard/worlds/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New World
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {worldsError ? (
                <div className="text-center text-destructive py-8">
                  <p>Failed to load worlds</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {worldsError instanceof Error ? worldsError.message : 'Unknown error'}
                  </p>
                </div>
              ) : isLoadingWorlds ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !worlds || worlds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No worlds found.</p>
                  <Button asChild className="mt-4">
                    <Link to="/dashboard/worlds/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First World
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {worlds.map((world) => (
                      <TableRow key={world.id}>
                        <TableCell className="font-medium">{world.display_name}</TableCell>
                        <TableCell>
                          <Badge variant={VISIBILITY_COLORS[world.visibility]}>
                            {world.visibility.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/worlds/edit/${world.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteWorld(world.id, world.display_name)}
                              disabled={deletingWorldId === world.id}
                            >
                              {deletingWorldId === world.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entities" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Entities</CardTitle>
                  <CardDescription>
                    {entities?.length || 0} entit{entities?.length !== 1 ? 'ies' : 'y'} found
                  </CardDescription>
                </div>
                <Button asChild>
                  <Link to="/dashboard/entities/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Entity
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {entitiesError ? (
                <div className="text-center text-destructive py-8">
                  <p>Failed to load entities</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {entitiesError instanceof Error ? entitiesError.message : 'Unknown error'}
                  </p>
                </div>
              ) : isLoadingEntities ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !entities || entities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No entities found.</p>
                  <Button asChild className="mt-4">
                    <Link to="/dashboard/entities/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Entity
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entities.map((entity) => (
                      <TableRow key={entity.id}>
                        <TableCell className="font-medium">{entity.display_name}</TableCell>
                        <TableCell>
                          <Badge variant={ENTITY_TYPE_COLORS[entity.entity_type]}>
                            {entity.entity_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={VISIBILITY_COLORS[entity.visibility]}>
                            {entity.visibility.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/entities/edit/${entity.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntity(entity.id, entity.display_name)}
                              disabled={deletingEntityId === entity.id}
                            >
                              {deletingEntityId === entity.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Stories</CardTitle>
                  <CardDescription>
                    {stories?.length || 0} stor{stories?.length !== 1 ? 'ies' : 'y'} found
                  </CardDescription>
                </div>
                <Button asChild>
                  <Link to="/dashboard/stories/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Story
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {storiesError ? (
                <div className="text-center text-destructive py-8">
                  <p>Failed to load stories</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {storiesError instanceof Error ? storiesError.message : 'Unknown error'}
                  </p>
                </div>
              ) : isLoadingStories ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !stories || stories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No stories found.</p>
                  <Button asChild className="mt-4">
                    <Link to="/dashboard/stories/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Story
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Display Name</TableHead>
                      <TableHead>World</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stories.map((story) => (
                      <TableRow key={story.id}>
                        <TableCell className="font-medium">{story.display_name}</TableCell>
                        <TableCell>
                          {story.world ? (
                            <span className="text-sm">{story.world.display_name}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">No world</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={VISIBILITY_COLORS[story.visibility]}>
                            {story.visibility.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => navigate(`/dashboard/stories/${story.id}/manage`)}
                            >
                              Studio
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/stories/edit/${story.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStory(story.id, story.display_name)}
                              disabled={deletingStoryId === story.id}
                            >
                              {deletingStoryId === story.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lore" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Lore Templates</CardTitle>
                  <CardDescription>
                    {lore?.length || 0} lore template{lore?.length !== 1 ? 's' : ''} found
                  </CardDescription>
                </div>
                <Button asChild>
                  <Link to="/dashboard/lore/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Lore
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loreError ? (
                <div className="text-center text-destructive py-8">
                  <p>Failed to load lore templates</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {loreError instanceof Error ? loreError.message : 'Unknown error'}
                  </p>
                </div>
              ) : isLoadingLore ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !lore || lore.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No lore templates found.</p>
                  <Button asChild className="mt-4">
                    <Link to="/dashboard/lore/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Lore Template
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lore.map((loreItem) => (
                      <TableRow key={loreItem.id}>
                        <TableCell className="font-medium">{loreItem.display_name}</TableCell>
                        <TableCell>v{loreItem.version}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {loreItem.tags && loreItem.tags.length > 0 ? (
                              loreItem.tags.map((tag) => (
                                <Badge key={tag.id} variant="outline" className="text-xs">
                                  {tag.tag_name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No tags</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={VISIBILITY_COLORS[loreItem.visibility]}>
                            {loreItem.visibility.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/lore/edit/${loreItem.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLore(loreItem.id, loreItem.display_name)}
                              disabled={deletingLoreId === loreItem.id}
                            >
                              {deletingLoreId === loreItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Content Packs</CardTitle>
                  <CardDescription>
                    {packs?.length || 0} pack{packs?.length !== 1 ? 's' : ''} found
                  </CardDescription>
                </div>
                <Button asChild>
                  <Link to="/dashboard/packs/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Pack
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {packsError ? (
                <div className="text-center text-destructive py-8">
                  <p>Failed to load packs</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {packsError instanceof Error ? packsError.message : 'Unknown error'}
                  </p>
                </div>
              ) : isLoadingPacks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !packs || packs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No content packs found.</p>
                  <Button asChild className="mt-4">
                    <Link to="/dashboard/packs/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Pack
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packs.map((pack) => (
                      <TableRow key={pack.id}>
                        <TableCell className="font-medium">{pack.display_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pack.pack_type}</Badge>
                        </TableCell>
                        <TableCell>v{pack.version}</TableCell>
                        <TableCell>
                          <Badge variant={VISIBILITY_COLORS[pack.visibility]}>
                            {pack.visibility.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/packs/edit/${pack.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePack(pack.id, pack.display_name)}
                              disabled={deletingPackId === pack.id}
                            >
                              {deletingPackId === pack.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

