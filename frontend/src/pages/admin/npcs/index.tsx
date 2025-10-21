/**
 * NPCs Admin Page
 * Phase 6: NPC catalog with search, filters, and management
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, UserPlus, Search, Edit, Trash2, Eye, AlertTriangle, Globe, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type NPC, type NPCFilters } from '@/services/admin.npcs';
import { useAppRoles } from '@/admin/routeGuard';

export default function NPCsAdmin() {
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const [npcs, setNPCs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<NPCFilters>({});
  const [search, setSearch] = useState('');
  const [worlds, setWorlds] = useState<Array<{ id: string; name: string }>>([]);
  const [roleTags, setRoleTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [npcToDelete, setNPCToDelete] = useState<NPC | null>(null);
  const [bindingsCount, setBindingsCount] = useState<Record<string, number>>({});

  // Load NPCs
  useEffect(() => {
    loadNPCs();
    loadWorlds();
    loadRoleTags();
  }, [filters, search, selectedTags]);

  const loadNPCs = async () => {
    try {
      setLoading(true);
      const response = await npcsService.listNPCs({
        ...filters,
        q: search || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined
      });
      setNPCs(response.data);

      // Load bindings count for each NPC
      const counts: Record<string, number> = {};
      for (const npc of response.data) {
        try {
          const count = await npcsService.getNPCBindingsCount(npc.id);
          counts[npc.id] = count;
        } catch (error) {
          console.error(`Failed to load bindings count for NPC ${npc.id}:`, error);
          counts[npc.id] = 0;
        }
      }
      setBindingsCount(counts);
    } catch (error) {
      toast.error('Failed to load NPCs');
      console.error('Error loading NPCs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorlds = async () => {
    try {
      const worldsData = await npcsService.getWorlds();
      setWorlds(worldsData);
    } catch (error) {
      console.error('Error loading worlds:', error);
    }
  };

  const loadRoleTags = async () => {
    try {
      const tagsData = await npcsService.getRoleTags();
      setRoleTags(tagsData);
    } catch (error) {
      console.error('Error loading role tags:', error);
    }
  };

  const handleDeleteNPC = async (npc: NPC) => {
    setNPCToDelete(npc);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async (force: boolean = false) => {
    if (!npcToDelete) return;

    try {
      await npcsService.deleteNPC(npcToDelete.id, force);
      toast.success('NPC deleted successfully');
      setDeleteDialogOpen(false);
      setNPCToDelete(null);
      loadNPCs();
    } catch (error) {
      if (error instanceof Error && error.message.includes('bindings')) {
        toast.error('Cannot delete NPC with existing bindings. Use force delete to remove anyway.');
      } else {
        toast.error('Failed to delete NPC');
        console.error('Error deleting NPC:', error);
      }
    }
  };

  const getRoleTagBadges = (tags: string[]) => {
    if (tags.length === 0) return <span className="text-muted-foreground text-sm">No tags</span>;
    
    return (
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 3).map(tag => (
          <Badge key={tag} variant="outline" className="text-xs">
            {tag}
          </Badge>
        ))}
        {tags.length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{tags.length - 3}
          </Badge>
        )}
      </div>
    );
  };

  const canEdit = isModerator || isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">NPCs</h1>
          <p className="text-muted-foreground">
            Manage non-player characters and their relationships
          </p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link to="/admin/npcs/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Add NPC
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search NPCs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="world">World</Label>
              <Select
                value={filters.worldId || ''}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    worldId: value || undefined 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All worlds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All worlds</SelectItem>
                  {worlds.map((world) => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Role Tags</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !selectedTags.includes(value)) {
                    setSelectedTags(prev => [...prev, value]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add tag filter" />
                </SelectTrigger>
                <SelectContent>
                  {roleTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Selected Tags</Label>
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NPCs Table */}
      <Card>
        <CardHeader>
          <CardTitle>NPCs ({npcs.length})</CardTitle>
          <CardDescription>
            Manage non-player characters and their relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>World</TableHead>
                  <TableHead>Archetype</TableHead>
                  <TableHead>Role Tags</TableHead>
                  <TableHead>Bindings</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {npcs.map((npc) => (
                  <TableRow key={npc.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {npc.portrait_url && (
                          <img
                            src={npc.portrait_url}
                            alt={npc.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium">{npc.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {npc.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{npc.world_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {npc.archetype ? (
                        <Badge variant="outline">{npc.archetype}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getRoleTagBadges(npc.role_tags)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {bindingsCount[npc.id] || 0} bindings
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(npc.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/npcs/${npc.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>

                        {canEdit && (
                          <>
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/admin/npcs/${npc.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNPC(npc)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete NPC</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this NPC? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {npcToDelete && (
            <div className="space-y-4">
              <div className="p-4 border rounded-md">
                <div className="font-medium">{npcToDelete.name}</div>
                <div className="text-sm text-muted-foreground">
                  {npcToDelete.archetype && `Archetype: ${npcToDelete.archetype}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  World: {npcToDelete.world_name}
                </div>
              </div>

              {bindingsCount[npcToDelete.id] > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This NPC has {bindingsCount[npcToDelete.id]} bindings to entry points. 
                    Deleting will remove all bindings as well.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete(false)}
            >
              Delete
            </Button>
            {npcToDelete && bindingsCount[npcToDelete.id] > 0 && (
              <Button
                variant="destructive"
                onClick={() => confirmDelete(true)}
              >
                Force Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}