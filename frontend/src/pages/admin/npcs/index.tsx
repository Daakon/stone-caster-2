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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type NPC, type NPCFilters } from '@/services/admin.npcs';
import { useAppRoles } from '@/admin/routeGuard';

export default function NPCsAdmin() {
  const { isModerator, isAdmin } = useAppRoles();
  const [npcs, setNPCs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<NPCFilters>({});
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [npcToDelete, setNPCToDelete] = useState<NPC | null>(null);

  // Load NPCs
  useEffect(() => {
    loadNPCs();
  }, [filters, search]);

  const loadNPCs = async () => {
    try {
      setLoading(true);
      const response = await npcsService.listNPCs({
        ...filters,
        search: search || undefined
      });
      setNPCs(response.data);

    } catch (error) {
      toast.error('Failed to load NPCs');
      console.error('Error loading NPCs:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleDeleteNPC = async (npc: NPC) => {
    setNPCToDelete(npc);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!npcToDelete) return;

    try {
      await npcsService.deleteNPC(npcToDelete.id);
      toast.success('NPC deleted successfully');
      setDeleteDialogOpen(false);
      setNPCToDelete(null);
      loadNPCs();
    } catch (error) {
      toast.error('Failed to delete NPC');
      console.error('Error deleting NPC:', error);
    }
  };


  const canEdit = isModerator || isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">NPCs</h1>
          <p className="text-muted-foreground">
            Manage your NPCs and browse public characters
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    status: value === 'all' ? undefined : value as 'draft' | 'active' | 'archived'
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={filters.visibility || 'all'}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    visibility: value === 'all' ? undefined : value as 'private' | 'public'
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All visibility</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="author_type">Author Type</Label>
              <Select
                value={filters.author_type || 'all'}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    author_type: value === 'all' ? undefined : value as 'user' | 'system' | 'original'
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All authors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All authors</SelectItem>
                  <SelectItem value="user">Player Characters</SelectItem>
                  <SelectItem value="original">Original Characters</SelectItem>
                  <SelectItem value="system">System Characters</SelectItem>
                </SelectContent>
              </Select>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {npcs.map((npc) => (
                  <TableRow key={npc.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{npc.name}</div>
                        <div className="text-sm text-muted-foreground">ID: {npc.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={npc.status === 'active' ? 'default' : npc.status === 'draft' ? 'secondary' : 'outline'}
                      >
                        {npc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={npc.visibility === 'public' ? 'default' : 'secondary'}
                      >
                        {npc.visibility}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{npc.author_name || 'Unknown'}</div>
                        <div className="text-muted-foreground">{npc.author_type}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {npc.description || (
                          <span className="text-muted-foreground text-sm">No description</span>
                        )}
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
                  Status: {npcToDelete.status}
                </div>
                {npcToDelete.description && (
                  <div className="text-sm text-muted-foreground">
                    {npcToDelete.description}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
