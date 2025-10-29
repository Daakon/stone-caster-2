/**
 * Entries Admin Page
 * List and manage entries with search and filters
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Filter, Edit, Trash2 } from 'lucide-react';

import { entriesService, type Entry, type EntryFilters } from '@/services/admin.entries';
import { worldsService, type World } from '@/services/admin.worlds';

export default function EntriesAdmin() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filters, setFilters] = useState<EntryFilters>({
    status: undefined,
    world_id: undefined,
    search: undefined
  });

  // Load data
  useEffect(() => {
    loadEntries();
  }, [page, filters]);

  useEffect(() => {
    loadWorlds();
  }, []);

  const loadWorlds = async () => {
    try {
      const worldsData = await worldsService.getActiveWorlds();
      setWorlds(worldsData);
    } catch (error) {
      console.error('Failed to load worlds:', error);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const response = await entriesService.listEntries(filters, page, 20);
      setEntries(response.data);
      setHasMore(response.hasMore);
      setTotalCount(response.count);
    } catch (error) {
      console.error('Failed to load entries:', error);
      toast.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search: search || undefined }));
    setPage(1);
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status: status as 'draft' | 'active' | 'archived' | undefined }));
    setPage(1);
  };

  const handleWorldFilter = (worldId: string) => {
    setFilters(prev => ({ ...prev, world_id: worldId || undefined }));
    setPage(1);
  };

  const handleToggleStatus = async (entry: Entry) => {
    try {
      setSaving(true);
      await entriesService.toggleStatus(entry.id);
      await loadEntries();
      toast.success(`Entry ${entry.status === 'active' ? 'archived' : 'activated'}`);
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Failed to update entry status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: Entry) => {
    if (!confirm(`Are you sure you want to delete "${entry.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setSaving(true);
      await entriesService.deleteEntry(entry.id);
      await loadEntries();
      toast.success('Entry deleted successfully');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete entry');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading entries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entries</h1>
          <p className="text-muted-foreground">
            Manage game entries and their associations
          </p>
        </div>
        <Button onClick={() => navigate('/admin/entries/new/edit')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Entry
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search entries..."
                  className="pl-10"
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={handleStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="world">World</Label>
              <Select onValueChange={handleWorldFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All worlds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All worlds</SelectItem>
                  {worlds.map(world => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({});
                  setPage(1);
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Entries ({totalCount})</CardTitle>
          <CardDescription>
            {entries.length} of {totalCount} entries shown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>World</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Rulesets</TableHead>
                <TableHead>NPCs</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{entry.name}</div>
                      {entry.description && (
                        <div className="text-sm text-muted-foreground">
                          {entry.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.world ? (
                      <Badge variant="outline">{entry.world.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">No world</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(entry.status)}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {entry.difficulty || 'medium'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.visibility === 'public' ? 'default' : 'secondary'}>
                      {entry.visibility || 'public'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {entry.tags?.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {entry.tags && entry.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{entry.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {entry.rulesets?.length || 0} rulesets
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {entry.npcs?.length || 0} NPCs, {entry.npc_packs?.length || 0} packs
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(entry.updated_at).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/entries/${entry.id}/edit`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(entry)}
                        disabled={saving}
                      >
                        {entry.status === 'active' ? 'Archive' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {entries.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No entries found</p>
              <Button
                className="mt-4"
                onClick={() => navigate('/admin/entries/new/edit')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create your first entry
              </Button>
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => setPage(prev => prev + 1)}
                disabled={loading}
              >
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
