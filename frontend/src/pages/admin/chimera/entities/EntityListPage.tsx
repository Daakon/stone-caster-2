/**
 * Admin Official Entities List Page
 * Lists all official entities (is_official = true) for admin management
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

interface OfficialEntity {
  id: string;
  key: string;
  kind: string;
  display_name: string;
  entity_type: string;
  description_short: string | null;
  visibility: string;
  is_official: boolean;
  created_at: string;
  updated_at: string;
  owner_user_id: string;
}

const ENTITY_TYPE_COLORS = {
  NPC: 'default',
  ITEM: 'secondary',
  FACTION: 'outline',
  LOCATION: 'destructive',
} as const;

export default function EntityListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: entities, isLoading, error } = useQuery<OfficialEntity[]>({
    queryKey: ['admin-official-entities'],
    queryFn: async () => {
      const result = await apiFetch<OfficialEntity[]>('/api/v2/chimera/admin/entities-official');
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch official entities');
      }
      return result.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  useEffect(() => {
    document.title = makeTitle(['Official Entities', 'Admin']);
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await apiDelete(`/api/v2/chimera/admin/entities-official/${id}`);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to delete entity');
      }

      toast.success('Entity deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['admin-official-entities'] });
    } catch (error) {
      console.error('Error deleting entity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete entity');
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
              <p>Failed to load official entities</p>
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
          <h1 className="text-3xl font-bold">Official Entities</h1>
          <p className="text-muted-foreground mt-2">
            Manage official Stone Caster entities (NPCs, Items, Factions, Locations)
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/chimera/entities/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Official Entity
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Official Entities</CardTitle>
          <CardDescription>
            {entities?.length || 0} official entit{entities?.length !== 1 ? 'ies' : 'y'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !entities || entities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No official entities found.</p>
              <Button asChild className="mt-4">
                <Link to="/admin/chimera/entities/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Official Entity
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium">{entity.display_name}</TableCell>
                    <TableCell>
                      <Badge variant={ENTITY_TYPE_COLORS[entity.entity_type as keyof typeof ENTITY_TYPE_COLORS] || 'secondary'}>
                        {entity.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{entity.kind}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entity.visibility === 'public' ? 'default' : 'secondary'}>
                        {entity.visibility}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(entity.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/chimera/entities/edit/${entity.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(entity.id, entity.display_name)}
                          disabled={deletingId === entity.id}
                        >
                          {deletingId === entity.id ? (
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
