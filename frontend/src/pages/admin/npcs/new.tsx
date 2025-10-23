import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type CreateNPCData } from '@/services/admin.npcs';
import { worldsService, type World } from '@/services/admin.worlds';

export default function CreateNPCPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [formData, setFormData] = useState<CreateNPCData>({
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
    loadWorlds();
  }, []);

  const loadWorlds = async () => {
    try {
      const response = await worldsService.listWorlds({ status: 'active' });
      setWorlds(response.data);
    } catch (error) {
      console.error('Failed to load worlds:', error);
      toast.error('Failed to load worlds');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!formData.world_id) {
      toast.error('World is required');
      return;
    }

    try {
      setLoading(true);
      await npcsService.createNPC(formData);
      toast.success('NPC created successfully');
      navigate('/admin/npcs');
    } catch (error) {
      toast.error('Failed to create NPC');
      console.error('Error creating NPC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateNPCData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate('/admin/npcs')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create NPC</h1>
          <p className="text-muted-foreground">
            Add a new non-player character
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Details</CardTitle>
          <CardDescription>
            Enter the basic information for this NPC. This NPC will be private to you.
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
              <Label htmlFor="world_id">World *</Label>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => handleChange('visibility', value)}
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
                  onValueChange={(value) => handleChange('author_type', value)}
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
                onClick={() => navigate('/admin/npcs')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Creating...' : 'Create NPC'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
