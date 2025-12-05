/**
 * Worlds Tab Component
 * Fetches and displays user's worlds - only loads when tab is active
 */

import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraWorldsService } from '@/services/chimera.worlds';
import { useState } from 'react';

const VISIBILITY_COLORS = {
  private: 'secondary',
  pending: 'default',
  public: 'default',
} as const;

export function WorldsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null);

  // Data fetching - only runs when this component is mounted (active tab)
  const { data: worlds, isLoading: isLoadingWorlds, error: worldsError } = useQuery({
    queryKey: ['chimera-my-worlds'],
    queryFn: () => chimeraWorldsService.getMyWorlds(),
    staleTime: 30 * 1000, // 30 seconds
  });

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

  return (
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
  );
}

