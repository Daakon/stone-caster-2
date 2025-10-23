import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type NPC } from '@/services/admin.npcs';
import { worldsService, type World } from '@/services/admin.worlds';
import { useAppRoles } from '@/admin/routeGuard';

export default function NPCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isModerator, isAdmin } = useAppRoles();
  const [npc, setNPC] = useState<NPC | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadNPC();
    }
  }, [id]);

  const loadNPC = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const npc = await npcsService.getNPC(id);
      setNPC(npc);
      
      // Load world if world_id exists
      if (npc.world_id) {
        try {
          const worldResponse = await worldsService.getWorld(npc.world_id);
          setWorld(worldResponse);
        } catch (worldError) {
          console.error('Failed to load world:', worldError);
        }
      }
    } catch (error) {
      toast.error('Failed to load NPC');
      console.error('Error loading NPC:', error);
      navigate('/admin/npcs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!npc) return;

    if (!window.confirm(`Are you sure you want to delete "${npc.name}"?`)) {
      return;
    }

    try {
      await npcsService.deleteNPC(npc.id);
      toast.success('NPC deleted successfully');
      navigate('/admin/npcs');
    } catch (error) {
      toast.error('Failed to delete NPC');
      console.error('Error deleting NPC:', error);
    }
  };

  const canEdit = isModerator || isAdmin;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading NPC...</p>
        </div>
      </div>
    );
  }

  if (!npc) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">NPC Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The NPC you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => navigate('/admin/npcs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to NPCs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/npcs')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{npc.name}</h1>
            <p className="text-muted-foreground">
              NPC Details
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/npcs/${npc.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* NPC Details */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Information</CardTitle>
          <CardDescription>
            Basic information about this NPC
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Name</Label>
              <p className="text-sm">{npc.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <div className="mt-1">
                <Badge 
                  variant={npc.status === 'active' ? 'default' : npc.status === 'draft' ? 'secondary' : 'outline'}
                >
                  {npc.status}
                </Badge>
              </div>
            </div>
          </div>

          {world && (
            <div>
              <Label className="text-sm font-medium">World</Label>
              <p className="text-sm">{world.name}</p>
            </div>
          )}

          {npc.description && (
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <p className="text-sm mt-1">{npc.description}</p>
            </div>
          )}

          {npc.prompt && (
            <div>
              <Label className="text-sm font-medium">AI Prompt</Label>
              <div className="mt-1 p-3 bg-muted rounded-md">
                <p className="text-sm whitespace-pre-wrap">{npc.prompt}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Created</Label>
              <p className="text-sm">{new Date(npc.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Updated</Label>
              <p className="text-sm">{new Date(npc.updated_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Visibility</Label>
              <div className="mt-1">
                <Badge variant={npc.visibility === 'public' ? 'default' : 'secondary'}>
                  {npc.visibility}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {npc.visibility === 'public' 
                  ? 'This NPC is visible to all players' 
                  : 'This NPC is private to you only'
                }
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Author</Label>
              <p className="text-sm font-medium">{npc.author_name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{npc.author_type}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
