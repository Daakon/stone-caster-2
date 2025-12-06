/**
 * Entities Tab Component
 * Fetches and displays user's entities - only loads when tab is active
 */

import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraEntitiesService } from '@/services/chimera.entities';
import { useState } from 'react';

const VISIBILITY_COLORS = {
  private: 'secondary',
  pending: 'default',
  public: 'default',
} as const;

const ENTITY_TYPE_COLORS = {
  NPC: 'default',
  ITEM: 'secondary',
  FACTION: 'outline',
  LOCATION: 'destructive',
} as const;

export function EntitiesTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingEntityId, setDeletingEntityId] = useState<string | null>(null);

  // Data fetching - only runs when this component is mounted (active tab)
  const { data: entities, isLoading: isLoadingEntities, error: entitiesError } = useQuery({
    queryKey: ['chimera-my-entities'],
    queryFn: () => chimeraEntitiesService.getMyEntities(),
    staleTime: 30 * 1000, // 30 seconds
  });

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

  return (
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
  );
}

