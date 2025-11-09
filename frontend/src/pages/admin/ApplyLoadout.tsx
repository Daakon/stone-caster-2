/**
 * Apply Loadout Page
 * Apply a loadout to a story
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAppRoles } from '@/admin/routeGuard';

interface Loadout {
  id: string;
  title: string;
  ruleset_id: string;
  modules: string[];
  overrides?: Record<string, { params?: Record<string, unknown> }>;
}

export default function ApplyLoadout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isEditor, isAdmin } = useAppRoles();
  const canEdit = isEditor || isAdmin;

  const [selectedLoadoutId, setSelectedLoadoutId] = useState<string>('');

  const { data: loadouts } = useQuery({
    queryKey: ['admin', 'loadouts'],
    queryFn: async () => {
      const res = await api.get('/api/admin/loadouts');
      if (!res.ok) throw new Error('Failed to fetch loadouts');
      return res.data as Loadout[];
    },
  });

  const { data: selectedLoadout } = useQuery({
    queryKey: ['admin', 'loadout', selectedLoadoutId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/loadouts/${selectedLoadoutId}`);
      if (!res.ok) throw new Error('Failed to fetch loadout');
      return res.data as Loadout;
    },
    enabled: !!selectedLoadoutId,
  });

  const applyMutation = useMutation({
    mutationFn: async (loadoutId: string) => {
      const res = await api.post(`/api/admin/stories/${id}/apply-loadout`, { loadoutId });
      if (!res.ok) throw new Error(res.error || 'Failed to apply loadout');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'story-modules', id] });
      toast.success('Loadout applied successfully');
      navigate(`/admin/stories/${id}/modules`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to apply loadout');
    },
  });

  const handleApply = () => {
    if (!selectedLoadoutId) {
      toast.error('Please select a loadout');
      return;
    }
    applyMutation.mutate(selectedLoadoutId);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/admin/stories/${id}/modules`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Apply Loadout</h1>
          <p className="text-muted-foreground">Apply a preset loadout to story {id}</p>
        </div>
      </div>

      {!canEdit && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You need editor role or higher to apply loadouts
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Loadout</CardTitle>
          <CardDescription>Choose a loadout to apply</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedLoadoutId} onValueChange={setSelectedLoadoutId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a loadout..." />
            </SelectTrigger>
            <SelectContent>
              {loadouts?.map(loadout => (
                <SelectItem key={loadout.id} value={loadout.id}>
                  {loadout.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedLoadout && (
        <Card>
          <CardHeader>
            <CardTitle>Loadout Preview</CardTitle>
            <CardDescription>Review what will be applied</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Ruleset</div>
              <Badge>{selectedLoadout.ruleset_id}</Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Modules</div>
              <div className="flex flex-wrap gap-2">
                {selectedLoadout.modules.map(moduleId => (
                  <Badge key={moduleId} variant="outline">{moduleId}</Badge>
                ))}
              </div>
            </div>
            {selectedLoadout.overrides && Object.keys(selectedLoadout.overrides).length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This loadout includes parameter overrides for {Object.keys(selectedLoadout.overrides).length} module(s)
                </AlertDescription>
              </Alert>
            )}
            {canEdit && (
              <Button onClick={handleApply} disabled={applyMutation.isPending} className="w-full">
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Apply Loadout
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

