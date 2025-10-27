/**
 * World Creation Page
 * Form for creating new worlds
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { worldsService, type CreateWorldData } from '@/services/admin.worlds';

export default function WorldNewPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateWorldData>({
    name: '',
    description: '',
    prompt: '',
    status: 'draft',
  });
  const [slug, setSlug] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      setLoading(true);
      const newWorld = await worldsService.createWorld(formData);
      toast.success('World created successfully');
      navigate(`/admin/worlds/${newWorld.id}`);
    } catch (error) {
      toast.error('Failed to create world');
      console.error('Error creating world:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateWorldData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate('/admin/worlds')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create World</h1>
          <p className="text-muted-foreground">
            Add a new game world
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>World Details</CardTitle>
          <CardDescription>
            Enter the basic information for this world.
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
                  onChange={(e) => {
                    handleChange('name', e.target.value);
                    // Auto-generate slug from name
                    const generatedSlug = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '');
                    setSlug(generatedSlug);
                  }}
                  placeholder="Enter world name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="world-slug"
                />
                <p className="text-sm text-muted-foreground">
                  URL-friendly identifier (auto-generated from name)
                </p>
              </div>
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

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Enter world description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt (JSONB)</Label>
              <Textarea
                id="prompt"
                value={typeof formData.prompt === 'string' ? formData.prompt : JSON.stringify(formData.prompt, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleChange('prompt', parsed);
                  } catch {
                    // If not valid JSON, store as string for now
                    handleChange('prompt', e.target.value);
                  }
                }}
                placeholder='Enter world prompt as JSON, e.g. {"system": "You are a fantasy world", "rules": ["No magic", "Medieval setting"]}'
                rows={8}
              />
              <p className="text-sm text-muted-foreground">
                Enter structured prompt data as JSON. This allows for complex, multi-part prompts with unlimited length.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/worlds')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Creating...' : 'Create World'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
