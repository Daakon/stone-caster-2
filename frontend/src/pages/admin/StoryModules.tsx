/**
 * Story Modules Page
 * Attach/detach modules to stories
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, X, Package, AlertTriangle, Info, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAppRoles } from '@/admin/routeGuard';

interface Module {
  id: string;
  title: string;
  version: number;
  state_slice: string;
  exports: {
    actions: Array<{ type: string }>;
  };
}

export default function StoryModules() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isEditor, isAdmin } = useAppRoles();
  const canEdit = isEditor || isAdmin;

  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');

  // Fetch attached modules
  const { data: attachedModules, isLoading } = useQuery({
    queryKey: ['admin', 'story-modules', id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/stories/${id}/modules`);
      if (!res.ok) throw new Error('Failed to fetch modules');
      return res.data as Module[];
    },
    enabled: !!id,
  });

  // Fetch all modules for attach dialog
  const { data: allModules } = useQuery({
    queryKey: ['admin', 'modules', 'all'],
    queryFn: async () => {
      const res = await api.get('/api/admin/modules');
      if (!res.ok) throw new Error('Failed to fetch modules');
      return res.data as Module[];
    },
  });

  const attachMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      const res = await api.post(`/api/admin/stories/${id}/modules`, { moduleId });
      if (!res.ok) throw new Error(res.error || 'Failed to attach module');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'story-modules', id] });
      setAttachDialogOpen(false);
      toast.success('Module attached successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to attach module');
    },
  });

  const detachMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      const res = await api.delete(`/api/admin/stories/${id}/modules/${moduleId}`);
      if (!res.ok) throw new Error(res.error || 'Failed to detach module');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'story-modules', id] });
      toast.success('Module detached successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to detach module');
    },
  });

  const availableModules = (allModules || []).filter(
    m => !attachedModules?.some(am => am.id === m.id) &&
         (!moduleSearch || m.title.toLowerCase().includes(moduleSearch.toLowerCase()) || m.id.includes(moduleSearch))
  );

  const handleDetach = (moduleId: string) => {
    if (confirm('Are you sure you want to detach this module?')) {
      detachMutation.mutate(moduleId);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/entry-points')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Story Modules</h1>
          <p className="text-muted-foreground">Manage modules attached to story {id}</p>
        </div>
      </div>

      {!canEdit && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You need editor role or higher to attach/detach modules
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attached Modules</CardTitle>
              <CardDescription>
                {attachedModules?.length || 0} module{(attachedModules?.length || 0) !== 1 ? 's' : ''} attached
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => setAttachDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Attach Module
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading modules...
            </div>
          ) : attachedModules && attachedModules.length > 0 ? (
            <div className="space-y-4">
              {attachedModules.map((module) => (
                <div key={module.id} className="border rounded p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4" />
                      <div className="font-semibold">{module.title}</div>
                      <Badge variant="outline">v{module.version}</Badge>
                      <Badge variant="secondary">{module.state_slice}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground font-mono mb-2">
                      {module.id}
                    </div>
                    {module.exports.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {module.exports.actions.map((action, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {action.type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/stories/${id}/modules/params?module=${module.id}`)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDetach(module.id)}
                        disabled={detachMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No modules attached. Click "Attach Module" to add one.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Attach Module</DialogTitle>
            <DialogDescription>
              Select a module to attach to this story
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search modules..."
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
            />
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {availableModules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No modules available
                </div>
              ) : (
                availableModules.map((module) => (
                  <div
                    key={module.id}
                    className="border rounded p-3 cursor-pointer hover:bg-muted"
                    onClick={() => attachMutation.mutate(module.id)}
                  >
                    <div className="font-semibold">{module.title}</div>
                    <div className="text-sm text-muted-foreground font-mono">{module.id}</div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">v{module.version}</Badge>
                      <Badge variant="secondary">{module.state_slice}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

