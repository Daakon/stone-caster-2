/**
 * AWF Adventure Starts Admin Page
 * Phase 2: Admin UI - Adventure start document management
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { awfAdminService, type AwfAdventureStart, type AwfAdventure } from '@/services/awfAdminService';

export default function AwfAdventureStartsAdmin() {
  const [adventureStarts, setAdventureStarts] = useState<AwfAdventureStart[]>([]);
  const [adventures, setAdventures] = useState<AwfAdventure[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStart, setEditingStart] = useState<AwfAdventureStart | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    adventure_ref: '',
    doc: '{}',
    use_once: true
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [startsResponse, storiesResponse] = await Promise.all([
        awfAdminService.getAdventureStarts(),
        awfAdminService.getStories()
      ]);

      if (startsResponse.ok && startsResponse.data) {
        setAdventureStarts(startsResponse.data);
      } else {
        toast.error(startsResponse.error || 'Failed to load adventure starts');
      }

      if (adventuresResponse.ok && adventuresResponse.data) {
        setAdventures(adventuresResponse.data);
      } else {
        toast.error(adventuresResponse.error || 'Failed to load adventures');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (start: AwfAdventureStart) => {
    setEditingStart(start);
    setFormData({
      adventure_ref: start.adventure_ref,
      doc: JSON.stringify(start.doc, null, 2),
      use_once: start.use_once
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleNew = () => {
    setEditingStart(null);
    setFormData({
      adventure_ref: '',
      doc: '{}',
      use_once: true
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingStart(null);
    setFormData({
      adventure_ref: '',
      doc: '{}',
      use_once: true
    });
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.adventure_ref.trim()) {
      errors.push('Adventure reference is required');
    }

    try {
      JSON.parse(formData.doc);
    } catch (error) {
      errors.push('Document must be valid JSON');
    }

    // Check if adventure_ref exists
    if (formData.adventure_ref && !adventures.find(a => a.id === formData.adventure_ref)) {
      errors.push('Selected adventure does not exist');
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
      
      const response = await awfAdminService.createAdventureStart({
        adventure_ref: formData.adventure_ref,
        doc,
        use_once: formData.use_once
      });

      if (response.ok) {
        toast.success('Adventure start saved successfully');
        await loadData();
        handleCancel();
      } else {
        toast.error(response.error || 'Failed to save adventure start');
      }
    } catch (error) {
      console.error('Error saving adventure start:', error);
      toast.error('Failed to save adventure start');
    }
  };

  const handleExport = (start: AwfAdventureStart) => {
    const exportData = {
      adventure_ref: start.adventure_ref,
      doc: start.doc,
      use_once: start.use_once
    };
    awfAdminService.exportDocument(exportData, `${start.adventure_ref}.json`);
    toast.success('Adventure start exported successfully');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    awfAdminService.importDocument(file)
      .then((data) => {
        setFormData({
          adventure_ref: data.adventure_ref || '',
          doc: JSON.stringify(data.doc || {}, null, 2),
          use_once: data.use_once || true
        });
        setIsEditing(true);
        toast.success('Adventure start imported successfully');
      })
      .catch((error) => {
        toast.error('Failed to import adventure start: ' + error.message);
      });

    // Reset file input
    event.target.value = '';
  };

  const getAdventureName = (adventureRef: string) => {
    const adventure = adventures.find(a => a.id === adventureRef);
    return adventure ? `${adventure.id} v${adventure.version}` : adventureRef;
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
          <h1 className="text-3xl font-bold">Adventure Starts</h1>
          <p className="text-muted-foreground">
            Manage AWF adventure start documents
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            id="import-adventure-start"
          />
          <label htmlFor="import-adventure-start">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </label>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Adventure Start
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

      {/* Adventure Reference Warning */}
      {formData.adventure_ref && !adventures.find(a => a.id === formData.adventure_ref) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selected adventure "{formData.adventure_ref}" does not exist. Please select a valid adventure.
          </AlertDescription>
        </Alert>
      )}

      {/* Editor Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingStart ? 'Edit Adventure Start' : 'New Adventure Start'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="adventure_ref">Adventure Reference</Label>
              <Select
                value={formData.adventure_ref}
                onValueChange={(value) => setFormData({ ...formData, adventure_ref: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an adventure..." />
                </SelectTrigger>
                <SelectContent>
                  {adventures.map((adventure) => (
                    <SelectItem key={adventure.id} value={adventure.id}>
                      {adventure.id} v{adventure.version}
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

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="use_once"
                checked={formData.use_once}
                onChange={(e) => setFormData({ ...formData, use_once: e.target.checked })}
              />
              <Label htmlFor="use_once">Use Once</Label>
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

      {/* Adventure Starts List */}
      <div className="grid gap-4">
        {adventureStarts.map((start) => (
          <Card key={start.adventure_ref}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-lg">
                    {start.adventure_ref}
                  </CardTitle>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    {getAdventureName(start.adventure_ref)}
                  </Badge>
                  {start.use_once && (
                    <Badge variant="secondary">Use Once</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(start)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(start)}
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
                  <strong>Updated:</strong> {new Date(start.updated_at).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {adventureStarts.length === 0 && !isEditing && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No adventure starts found.</p>
            <Button onClick={handleNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Adventure Start
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
