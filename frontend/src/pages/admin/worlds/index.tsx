/**
 * Worlds Admin Index Page
 * Lists and manages worlds with CRUD operations
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { worldsService, type World, type WorldFilters } from '@/services/admin.worlds';
import { useAppRoles } from '@/admin/routeGuard';

export default function WorldsAdmin() {
  const navigate = useNavigate();
  const { isCreator, isModerator, isAdmin, loading: rolesLoading } = useAppRoles();
  
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<WorldFilters>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const hasWriteAccess = isCreator || isModerator || isAdmin;

  useEffect(() => {
    if (!rolesLoading) {
      loadWorlds();
    }
  }, [rolesLoading, filters, page]);

  const loadWorlds = async () => {
    try {
      setLoading(true);
      const response = await worldsService.listWorlds(
        { ...filters, search: search || undefined },
        page,
        20
      );
      setWorlds(response.data || []);
      setTotalCount(response.count);
    } catch (error) {
      console.error('Failed to load worlds:', error);
      toast.error('Failed to load worlds');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this world?')) {
      return;
    }

    try {
      await worldsService.deleteWorld(id);
      toast.success('World deleted successfully');
      loadWorlds();
    } catch (error) {
      console.error('Failed to delete world:', error);
      toast.error('Failed to delete world');
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilterChange = (key: keyof WorldFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' || value === '' ? undefined : (value as any)
    }));
    setPage(1);
  };

  if (rolesLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!hasWriteAccess) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Worlds</h1>
          <p className="text-gray-600">Manage game worlds and settings</p>
        </div>
        <Button onClick={() => navigate('/admin/worlds/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create World
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search worlds..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Worlds ({totalCount})</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${worlds.length} worlds found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading worlds...</div>
          ) : worlds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No worlds found. Create your first world to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {worlds.map((world) => (
                  <TableRow key={world.id}>
                    <TableCell className="font-medium">{world.name}</TableCell>
                    <TableCell className="text-gray-500">{world.slug}</TableCell>
                    <TableCell>
                      <Badge variant={
                        world.status === 'active' ? 'default' :
                        world.status === 'draft' ? 'secondary' : 'outline'
                      }>
                        {world.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {new Date(world.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/worlds/${world.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/worlds/${world.id}/edit`)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(world.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}




