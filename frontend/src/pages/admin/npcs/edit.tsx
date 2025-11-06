import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type UpdateNPCData, type NPC } from '@/services/admin.npcs';
import { worldsService, type World } from '@/services/admin.worlds';

// Extended NPC type to include fields that may be returned from API
interface ExtendedNPC extends NPC {
  world_id?: string;
  visibility?: 'private' | 'public';
  author_name?: string;
  author_type?: 'user' | 'original' | 'system';
}

// Extended update data to include all fields
interface ExtendedUpdateNPCData extends UpdateNPCData {
  world_id?: string;
  visibility?: 'private' | 'public';
  author_name?: string;
  author_type?: 'user' | 'original' | 'system';
}

export default function EditNPCPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [loadingNPC, setLoadingNPC] = useState(true);
  const [worldsLoading, setWorldsLoading] = useState(true);
  const [npc, setNPC] = useState<ExtendedNPC | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [formData, setFormData] = useState<ExtendedUpdateNPCData>({
    name: '',
    description: '',
    status: 'draft',
    prompt: '',
    world_id: '',
    visibility: 'private',
    author_name: '',
    author_type: 'user',
  });

  useEffect(() => {
    if (id) {
      loadNPC();
      loadWorlds();
    }
  }, [id]);

  const loadNPC = async () => {
    if (!id) return;
    
    try {
      setLoadingNPC(true);
      const npcData = await npcsService.getNPC(id) as ExtendedNPC;
      setNPC(npcData);
      
      // Parse the prompt if it exists
      let parsedPrompt = '';
      if (npcData.prompt) {
        try {
          if (typeof npcData.prompt === 'string') {
            parsedPrompt = npcData.prompt;
          } else {
            parsedPrompt = JSON.stringify(npcData.prompt, null, 2);
          }
        } catch (error) {
          console.error('Error parsing prompt:', error);
          parsedPrompt = String(npcData.prompt || '');
        }
      }

      setFormData({
        name: npcData.name,
        description: npcData.description || '',
        prompt: parsedPrompt,
        status: npcData.status,
        world_id: npcData.world_id || '',
        visibility: npcData.visibility || 'private',
        author_name: npcData.author_name || '',
        author_type: npcData.author_type || 'user',
      });
    } catch (error) {
      toast.error('Failed to load NPC');
      console.error('Error loading NPC:', error);
      navigate('/admin/npcs');
    } finally {
      setLoadingNPC(false);
    }
  };

  const loadWorlds = async () => {
    try {
      setWorldsLoading(true);
      const response = await worldsService.listWorlds({ status: 'active' });
      setWorlds(response.data || []);
    } catch (error) {
      console.error('Failed to load worlds:', error);
      toast.error('Failed to load worlds');
      setWorlds([]);
    } finally {
      setWorldsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!id) return;

    try {
      setLoading(true);
      
      // Prepare update data
      const updateData: ExtendedUpdateNPCData = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
      };

      // Add optional fields if they exist
      if (formData.prompt) {
        try {
          // Try to parse as JSON, if it fails, use as string
          const parsed = JSON.parse(formData.prompt as string);
          updateData.prompt = parsed;
        } catch {
          updateData.prompt = formData.prompt;
        }
      }

      if (formData.world_id) {
        updateData.world_id = formData.world_id;
      }

      if (formData.visibility) {
        updateData.visibility = formData.visibility;
      }

      if (formData.author_type) {
        updateData.author_type = formData.author_type;
      }

      if (formData.author_name) {
        updateData.author_name = formData.author_name;
      }

      await npcsService.updateNPC(id, updateData);
      toast.success('NPC updated successfully');
      navigate(`/admin/npcs/${id}`);
    } catch (error) {
      toast.error('Failed to update NPC');
      console.error('Error updating NPC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ExtendedUpdateNPCData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loadingNPC || worldsLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading NPC...</p>
        </div>
      </div>
    );
  }

  if (!npc) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold mb-2">NPC Not Found</h2>
        <p className="text-muted-foreground mb-4">The NPC you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/admin/npcs')}>
          Back to NPCs
        </Button>
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
            Update NPC information
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Details</CardTitle>
          <CardDescription>
            Update the information for this NPC.
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
                  onValueChange={(value) => handleChange('status', value as 'draft' | 'active' | 'archived')}
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
                  {worlds?.map((world) => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => handleChange('visibility', value as 'private' | 'public')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (Only you can see)</SelectItem>
                    <SelectItem value="public">Public (Everyone can see)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="author_type">Author Type</Label>
                <Select
                  value={formData.author_type}
                  onValueChange={(value) => handleChange('author_type', value as 'user' | 'original' | 'system')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Player Character</SelectItem>
                    <SelectItem value="original">Original Character</SelectItem>
                    <SelectItem value="system">System Character</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.author_type === 'original' && (
              <div className="space-y-2">
                <Label htmlFor="author_name">Author Name</Label>
                <Input
                  id="author_name"
                  value={formData.author_name}
                  onChange={(e) => handleChange('author_name', e.target.value)}
                  placeholder="e.g., J.R.R. Tolkien, George Lucas"
                />
              </div>
            )}

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
                value={typeof formData.prompt === 'string' ? formData.prompt : JSON.stringify(formData.prompt, null, 2)}
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

