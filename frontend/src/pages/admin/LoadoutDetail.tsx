/**
 * Loadout Detail Page
 * View loadout details and apply to story
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAppRoles } from '@/admin/routeGuard';

interface Loadout {
  id: string;
  base_id: string;
  version: number;
  title: string;
  description?: string;
  ruleset_id: string;
  modules: string[];
  overrides?: Record<string, { params?: Record<string, unknown> }>;
  created_at: string;
}

export default function LoadoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isEditor, isAdmin } = useAppRoles();
  const canEdit = isEditor || isAdmin;

  const { data: loadout, isLoading, error } = useQuery({
    queryKey: ['admin', 'loadout', id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/loadouts/${id}`);
      if (!res.ok) throw new Error('Failed to fetch loadout');
      return res.data as Loadout;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="p-6">Loading loadout...</div>;
  }

  if (error || !loadout) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-destructive">
          Failed to load loadout
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/loadouts')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{loadout.title}</h1>
          <p className="text-muted-foreground">{loadout.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Base ID</div>
              <div className="font-mono">{loadout.base_id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Version</div>
              <Badge variant="outline">v{loadout.version}</Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Ruleset</div>
              <div>{loadout.ruleset_id}</div>
            </div>
            {loadout.description && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Description</div>
                <div>{loadout.description}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <CardDescription>
              {loadout.modules.length} module{loadout.modules.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {loadout.modules.map((moduleId) => (
                <div key={moduleId} className="flex items-center justify-between border rounded p-2">
                  <div className="font-mono text-sm">{moduleId}</div>
                  {loadout.overrides?.[moduleId] && (
                    <Badge variant="secondary">Has overrides</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {loadout.overrides && Object.keys(loadout.overrides).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Parameter Overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(loadout.overrides).map(([moduleId, override]) => (
                <div key={moduleId} className="border rounded p-4">
                  <div className="font-semibold mb-2">{moduleId}</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(override.params, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

