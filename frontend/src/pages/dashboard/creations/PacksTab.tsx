/**
 * Packs Tab Component
 * Fetches and displays user's content packs - only loads when tab is active
 */

import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraPacksService } from '@/services/chimera.packs';
import { useState } from 'react';

const VISIBILITY_COLORS = {
  private: 'secondary',
  pending: 'default',
  public: 'default',
} as const;

export function PacksTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingPackId, setDeletingPackId] = useState<string | null>(null);

  // Data fetching - only runs when this component is mounted (active tab)
  const { data: packs, isLoading: isLoadingPacks, error: packsError } = useQuery({
    queryKey: ['chimera-my-packs'],
    queryFn: () => chimeraPacksService.getMyPacks(),
    staleTime: 30 * 1000, // 30 seconds
  });

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

  return (
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
  );
}

