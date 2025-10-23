import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type NPC, type UpdateNPCData } from '@/services/admin.npcs';
import { worldsService, type World } from '@/services/admin.worlds';

export default function EditNPCPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [npc, setNPC] = useState<NPC | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [formData, setFormData] = useState<UpdateNPCData>({
    name: '',
    description: '',
    status: 'draft',
    prompt: '',
    world_id: '',
  });

  useEffect(() => {
    if (id) {
      loadNPC();
      loadWorlds();
    }
  }, [id]);

  const loadWorlds = async () => {
    try {
      const response = await worldsService.listWorlds({ status: 'active' });
      setWorlds(response.data);
    } catch (error) {
      console.error('Failed to load worlds:', error);
      toast.error('Failed to load worlds');
    }
  };

  const loadNPC = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const npc = await npcsService.getNPC(id);
      setNPC(npc);
      setFormData({
        name: npc.name,
        description: npc.description || '',
        status: npc.status,
        prompt: npc.prompt || '',
        world_id: npc.world_id || '',
      });
    } catch (error) {
      toast.error('Failed to load NPC');
      console.error('Error loading NPC:', error);
      navigate('/admin/npcs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id) return;
    if (!formData.name?.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      setLoading(true);
      await npcsService.updateNPC(id, formData);
      toast.success('NPC updated successfully');
      navigate(`/admin/npcs/${id}`);
    } catch (error) {
      toast.error('Failed to update NPC');
      console.error('Error updating NPC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof UpdateNPCData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/admin/npcs/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit NPC</h1>
          <p className="text-muted-foreground">
            Update the information for {npc.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Details</CardTitle>
          <CardDescription>
            Update the basic information for this NPC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter NPC name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="world_id">World</Label>
              <Select
                value={formData.world_id}
                onValueChange={(value) => handleChange('world_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a world" />
                </SelectTrigger>
                <SelectContent>
                  {worlds.map((world) => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Enter NPC description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) => handleChange('prompt', e.target.value)}
                placeholder="Enter NPC prompt/instructions for the AI"
                rows={6}
              />
              <p className="text-sm text-muted-foreground">
                This is the AI prompt that will be used when this NPC appears in the game.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/admin/npcs/${id}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Updating...' : 'Update NPC'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
