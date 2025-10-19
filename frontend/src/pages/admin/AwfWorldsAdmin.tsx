/**
 * AWF Worlds Admin Page
 * Phase 2: Admin UI - World document management
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Edit, 
  Save, 
  X, 
  Download,
  Upload,
  AlertTriangle,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { awfAdminService, type AwfWorld } from '@/services/awfAdminService';

export default function AwfWorldsAdmin() {
  const [worlds, setWorlds] = useState<AwfWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorld, setEditingWorld] = useState<AwfWorld | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    version: '',
    doc: '{}',
    slices: [] as string[]
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [newSlice, setNewSlice] = useState('');

  // Load worlds on mount
  useEffect(() => {
    loadWorlds();
  }, []);

  const loadWorlds = async () => {
    try {
      setLoading(true);
      const response = await awfAdminService.getWorlds();
      if (response.ok && response.data) {
        setWorlds(response.data);
      } else {
        toast.error(response.error || 'Failed to load worlds');
      }
    } catch (error) {
      console.error('Error loading worlds:', error);
      toast.error('Failed to load worlds');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (world: AwfWorld) => {
    setEditingWorld(world);
    const doc = world.doc as any;
    setFormData({
      id: world.id,
      version: world.version,
      doc: JSON.stringify(world.doc, null, 2),
      slices: doc.slices || []
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

    const handleNew = () => {
      setEditingWorld(null);
      setFormData({
        id: '',
        version: '',
        doc: JSON.stringify({
          id: 'world.<slug>',
          name: 'World Name',
          version: '1.0.0',
          timeworld: {
            timezone: 'UTC',
            calendar: 'Gregorian',
            seasons: ['Spring', 'Summer', 'Autumn', 'Winter']
          },
          slices: []
        }, null, 2),
        slices: []
      });
      setIsEditing(true);
      setValidationErrors([]);
    };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingWorld(null);
    setFormData({
      id: '',
      version: '',
      doc: JSON.stringify({
        id: 'world.<slug>',
        name: 'World Name',
        version: '1.0.0',
        timeworld: {
          timezone: 'UTC',
          calendar: 'Gregorian',
          seasons: ['Spring', 'Summer', 'Autumn', 'Winter']
        },
        slices: []
      }, null, 2),
      slices: []
    });
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.id.trim()) {
      errors.push('ID is required');
    }

    if (!formData.version.trim()) {
      errors.push('Version is required');
    }

    try {
      const doc = JSON.parse(formData.doc);
      
      // Validate document structure
      if (!doc.id || typeof doc.id !== 'string') {
        errors.push('Document must have an "id" field');
      }
      if (!doc.name || typeof doc.name !== 'string') {
        errors.push('Document must have a "name" field');
      }
      if (!doc.version || typeof doc.version !== 'string') {
        errors.push('Document must have a "version" field');
      }
      
      // Validate timeworld if present
      if (doc.timeworld) {
        if (!doc.timeworld.timezone || typeof doc.timeworld.timezone !== 'string') {
          errors.push('Timeworld timezone is required and must be a string');
        }
        if (!doc.timeworld.calendar || typeof doc.timeworld.calendar !== 'string') {
          errors.push('Timeworld calendar is required and must be a string');
        }
      }

    } catch (error) {
      errors.push('Document must be valid JSON');
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
      
      const response = await awfAdminService.createWorld({
        id: formData.id,
        version: formData.version,
        doc
      });

      if (response.ok) {
        toast.success('World saved successfully');
        await loadWorlds();
        handleCancel();
      } else {
        // Show detailed validation errors
        if (response.details && Array.isArray(response.details)) {
          const errorMessages = response.details.map((detail: any) => {
            if (typeof detail === 'object' && detail.message) {
              return `${detail.path?.join('.') || 'document'}: ${detail.message}`;
            }
            return detail;
          });
          setValidationErrors(errorMessages);
          toast.error('Validation failed - see errors below');
        } else {
          toast.error(response.error || 'Failed to save world');
        }
      }
    } catch (error) {
      console.error('Error saving world:', error);
      toast.error('Failed to save world');
    }
  };

  const handleExport = (world: AwfWorld) => {
    const exportData = {
      id: world.id,
      version: world.version,
      hash: world.hash,
      doc: world.doc
    };
    awfAdminService.exportDocument(exportData, `${world.id}.${world.version}.json`);
    toast.success('World exported successfully');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    awfAdminService.importDocument(file)
      .then((data) => {
        const doc = data.doc || {};
        setFormData({
          id: data.id || '',
          version: data.version || '',
          doc: JSON.stringify(doc, null, 2),
          slices: doc.slices || []
        });
        setIsEditing(true);
        toast.success('World imported successfully');
      })
      .catch((error) => {
        toast.error('Failed to import world: ' + error.message);
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
          <h1 className="text-3xl font-bold">Worlds</h1>
          <p className="text-muted-foreground">
            Manage AWF world documents
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            id="import-world"
          />
          <label htmlFor="import-world">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </label>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            New World
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

      {/* Editor Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingWorld ? 'Edit World' : 'New World'}
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
                  placeholder="e.g., world.mystika"
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

      {/* Worlds List */}
      <div className="grid gap-4">
        {worlds.map((world) => {
          const doc = world.doc as any;
          const slices = doc.slices || [];
          return (
            <Card key={`${world.id}-${world.version}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-lg">
                      {world.id} v{world.version}
                    </CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(world)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(world)}
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
                    <strong>Hash:</strong> {world.hash}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>Updated:</strong> {new Date(world.updated_at).toLocaleString()}
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

      {worlds.length === 0 && !isEditing && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No worlds found.</p>
            <Button onClick={handleNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First World
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


