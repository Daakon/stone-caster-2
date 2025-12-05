/**
 * Admin Official Worlds List Page
 * Lists all official worlds (is_official = true) for admin management
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { makeTitle } from '@/lib/meta';
import { useEffect } from 'react';
import { apiFetch, apiDelete } from '@/lib/api';

interface OfficialWorld {
  id: string;
  key: string;
  name: string;
  slug: string;
  visibility: string;
  is_official: boolean;
  created_at: string;
  updated_at: string;
  owner_user_id: string;
}

export default function WorldListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: worlds, isLoading, error } = useQuery<OfficialWorld[]>({
    queryKey: ['admin-official-worlds'],
    queryFn: async () => {
      const result = await apiFetch<OfficialWorld[]>('/api/v2/chimera/admin/worlds');
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch official worlds');
      }
      return result.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  useEffect(() => {
    document.title = makeTitle(['Official Worlds', 'Admin']);
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await apiDelete(`/api/v2/chimera/admin/worlds/${id}`);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to delete world');
      }

      toast.success('World deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['admin-official-worlds'] });
    } catch (error) {
      console.error('Error deleting world:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete world');
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>Failed to load official worlds</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Official Worlds</h1>
          <p className="text-muted-foreground mt-2">
            Manage official Stone Caster worlds (visible to all users)
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/chimera/worlds/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Official World
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Official Worlds</CardTitle>
          <CardDescription>
            {worlds?.length || 0} official world{worlds?.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !worlds || worlds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No official worlds found.</p>
              <Button asChild className="mt-4">
                <Link to="/admin/chimera/worlds/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Official World
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {worlds.map((world) => (
                  <TableRow key={world.id}>
                    <TableCell className="font-medium">{world.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{world.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={world.visibility === 'public' ? 'default' : 'secondary'}>
                        {world.visibility}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(world.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/chimera/worlds/edit/${world.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(world.id, world.name)}
                          disabled={deletingId === world.id}
                        >
                          {deletingId === world.id ? (
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
    </div>
  );
}
