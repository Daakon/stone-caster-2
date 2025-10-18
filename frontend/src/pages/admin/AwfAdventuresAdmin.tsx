/**
 * AWF Adventures Admin Page
 * Phase 2: Admin UI - Adventure document management
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Edit, 
  Save, 
  X, 
  Download,
  Upload,
  AlertTriangle,
  Tag,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { awfAdminService, type AwfAdventure, type AwfWorld } from '@/services/awfAdminService';

export default function AwfAdventuresAdmin() {
  const [adventures, setAdventures] = useState<AwfAdventure[]>([]);
  const [worlds, setWorlds] = useState<AwfWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAdventure, setEditingAdventure] = useState<AwfAdventure | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    world_ref: '',
    version: '',
    doc: '{}',
    slices: [] as string[]
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [newSlice, setNewSlice] = useState('');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [adventuresResponse, worldsResponse] = await Promise.all([
        awfAdminService.getAdventures(),
        awfAdminService.getWorlds()
      ]);

      if (adventuresResponse.ok && adventuresResponse.data) {
        setAdventures(adventuresResponse.data);
      } else {
        toast.error(adventuresResponse.error || 'Failed to load adventures');
      }

      if (worldsResponse.ok && worldsResponse.data) {
        setWorlds(worldsResponse.data);
      } else {
        toast.error(worldsResponse.error || 'Failed to load worlds');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (adventure: AwfAdventure) => {
    setEditingAdventure(adventure);
    const doc = adventure.doc as any;
    setFormData({
      id: adventure.id,
      world_ref: adventure.world_ref,
      version: adventure.version,
      doc: JSON.stringify(adventure.doc, null, 2),
      slices: doc.slices || []
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleNew = () => {
    setEditingAdventure(null);
    setFormData({
      id: '',
      world_ref: '',
      version: '',
      doc: '{}',
      slices: []
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingAdventure(null);
    setFormData({
      id: '',
      world_ref: '',
      version: '',
      doc: '{}',
      slices: []
    });
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.id.trim()) {
      errors.push('ID is required');
    }

    if (!formData.world_ref.trim()) {
      errors.push('World reference is required');
    }

    if (!formData.version.trim()) {
      errors.push('Version is required');
    }

    try {
      JSON.parse(formData.doc);
    } catch (error) {
      errors.push('Document must be valid JSON');
    }

    // Check if world_ref exists
    if (formData.world_ref && !worlds.find(w => w.id === formData.world_ref)) {
      errors.push('Selected world does not exist');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const doc = JSON.parse(formData.doc);
      // Add slices to the document
      doc.slices = formData.slices;
      
      const response = await awfAdminService.createAdventure({
        id: formData.id,
        world_ref: formData.world_ref,
        version: formData.version,
        doc
      });

      if (response.ok) {
        toast.success('Adventure saved successfully');
        await loadData();
        handleCancel();
      } else {
        toast.error(response.error || 'Failed to save adventure');
      }
    } catch (error) {
      console.error('Error saving adventure:', error);
      toast.error('Failed to save adventure');
    }
  };

  const handleExport = (adventure: AwfAdventure) => {
    const exportData = {
      id: adventure.id,
      version: adventure.version,
      hash: adventure.hash,
      doc: adventure.doc
    };
    awfAdminService.exportDocument(exportData, `${adventure.id}.${adventure.version}.json`);
    toast.success('Adventure exported successfully');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    awfAdminService.importDocument(file)
      .then((data) => {
        const doc = data.doc || {};
        setFormData({
          id: data.id || '',
          world_ref: data.world_ref || '',
          version: data.version || '',
          doc: JSON.stringify(doc, null, 2),
          slices: doc.slices || []
        });
        setIsEditing(true);
        toast.success('Adventure imported successfully');
      })
      .catch((error) => {
        toast.error('Failed to import adventure: ' + error.message);
      });

    // Reset file input
    event.target.value = '';
  };

  const addSlice = () => {
    if (newSlice.trim() && !formData.slices.includes(newSlice.trim())) {
      setFormData({
        ...formData,
        slices: [...formData.slices, newSlice.trim()]
      });
      setNewSlice('');
    }
  };

  const removeSlice = (slice: string) => {
    setFormData({
      ...formData,
      slices: formData.slices.filter(s => s !== slice)
    });
  };

  const getWorldName = (worldRef: string) => {
    const world = worlds.find(w => w.id === worldRef);
    return world ? `${world.id} v${world.version}` : worldRef;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Adventures</h1>
          <p className="text-muted-foreground">
            Manage AWF adventure documents
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            id="import-adventure"
          />
          <label htmlFor="import-adventure">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </label>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Adventure
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* World Reference Warning */}
      {formData.world_ref && !worlds.find(w => w.id === formData.world_ref) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selected world "{formData.world_ref}" does not exist. Please select a valid world.
          </AlertDescription>
        </Alert>
      )}

      {/* Editor Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingAdventure ? 'Edit Adventure' : 'New Adventure'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="id">ID</Label>
                <Input
                  id="id"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="e.g., adv.whispercross"
                />
              </div>
              <div>
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="e.g., v1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="world_ref">World Reference</Label>
              <Select
                value={formData.world_ref}
                onValueChange={(value) => setFormData({ ...formData, world_ref: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a world..." />
                </SelectTrigger>
                <SelectContent>
                  {worlds.map((world) => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.id} v{world.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="doc">Document (JSON)</Label>
              <Textarea
                id="doc"
                value={formData.doc}
                onChange={(e) => setFormData({ ...formData, doc: e.target.value })}
                placeholder="Enter JSON document..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {/* Slices Editor */}
            <div>
              <Label>Slices</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Slices are named subsets your runtime can request to reduce tokens (e.g., timekeeping, whispercross_region, encounter_forest_edge).
              </p>
              <div className="flex items-center space-x-2 mb-2">
                <Input
                  value={newSlice}
                  onChange={(e) => setNewSlice(e.target.value)}
                  placeholder="Enter slice name..."
                  onKeyPress={(e) => e.key === 'Enter' && addSlice()}
                />
                <Button onClick={addSlice} size="sm">
                  <Tag className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.slices.map((slice, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {slice}
                    <button
                      onClick={() => removeSlice(slice)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adventures List */}
      <div className="grid gap-4">
        {adventures.map((adventure) => {
          const doc = adventure.doc as any;
          const slices = doc.slices || [];
          return (
            <Card key={`${adventure.id}-${adventure.version}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-lg">
                      {adventure.id} v{adventure.version}
                    </CardTitle>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {getWorldName(adventure.world_ref)}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(adventure)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(adventure)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <strong>Hash:</strong> {adventure.hash}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>Updated:</strong> {new Date(adventure.updated_at).toLocaleString()}
                  </div>
                  {slices.length > 0 && (
                    <div className="text-sm">
                      <strong>Slices:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {slices.map((slice: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {slice}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {adventures.length === 0 && !isEditing && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No adventures found.</p>
            <Button onClick={handleNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Adventure
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


