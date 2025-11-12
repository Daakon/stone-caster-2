/**
 * World Detail/Edit Page
 * View and edit individual world
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { worldsService, type World } from '@/services/admin.worlds';
import { WorldForm } from '@/admin/components/WorldForm';
import { useAppRoles } from '@/admin/routeGuard';
import { ExtrasForm } from '@/components/admin/ExtrasForm';

export default function WorldDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isCreator, isModerator, isAdmin, loading: rolesLoading } = useAppRoles();
  
  const [world, setWorld] = useState<World & { extras?: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasWriteAccess = isCreator || isModerator || isAdmin;

  useEffect(() => {
    if (id && id !== 'new' && !rolesLoading) {
      loadWorld();
    } else if (id === 'new') {
      setLoading(false);
      setIsEditing(true);
    }
  }, [id, rolesLoading]);

  const loadWorld = async () => {
    if (!id || id === 'new') return;
    
    try {
      setLoading(true);
      const data = await worldsService.getWorld(id);
      setWorld(data);
    } catch (error) {
      console.error('Failed to load world:', error);
      toast.error('Failed to load world');
      navigate('/admin/worlds');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const newWorld = await worldsService.createWorld(data);
      toast.success('World created successfully');
      navigate(`/admin/worlds/${newWorld.id}`);
    } catch (error) {
      console.error('Failed to create world:', error);
      throw error;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!id || id === 'new') return;
    
    try {
      const updatedWorld = await worldsService.updateWorld(id, data);
      setWorld(updatedWorld);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update world:', error);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this world? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await worldsService.deleteWorld(id);
      toast.success('World deleted successfully');
      navigate('/admin/worlds');
    } catch (error) {
      console.error('Failed to delete world:', error);
      toast.error('Failed to delete world');
    } finally {
      setIsDeleting(false);
    }
  };

  if (rolesLoading || loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!world) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">World Not Found</h1>
          <p className="text-gray-600">The world you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/admin/worlds')} className="mt-4">
            Back to Worlds
          </Button>
        </div>
      </div>
    );
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
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/worlds')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {id === 'new' ? 'Create World' : world?.name}
          </h1>
          <p className="text-gray-600">
            {id === 'new' ? 'Add a new world' : 'World Management'}
          </p>
        </div>
        {!isEditing && id !== 'new' && (
          <div className="flex gap-2">
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <WorldForm
          world={id === 'new' ? undefined : world}
          onSubmit={id === 'new' ? handleCreate : handleUpdate}
          onCancel={() => id === 'new' ? navigate('/admin/worlds') : setIsEditing(false)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-lg">{world.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Slug</label>
                <p className="text-lg font-mono">{world.slug}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <Badge variant={
                    world.status === 'active' ? 'default' :
                    world.status === 'draft' ? 'secondary' : 'outline'
                  }>
                    {world.status}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="text-lg">{world.description || 'No description'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {world.description ? (
                <p className="text-gray-700 whitespace-pre-wrap">{world.description}</p>
              ) : (
                <p className="text-gray-500 italic">No description provided</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-lg">{new Date(world.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="text-lg">{new Date(world.updated_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Prompt</label>
                <p className="text-lg">{world.prompt || 'No prompt provided'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}




