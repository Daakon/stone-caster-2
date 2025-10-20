/**
 * AWF Adventures Admin Page (Flexible)
 * Admin interface for managing adventures with flexible schemas
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Download, Upload, Trash2, Edit, Globe, Users } from 'lucide-react';

interface Adventure {
  id: string;
  version: string;
  doc: {
    id: string;
    name: string;
    version: string;
    world_ref: string;
    synopsis?: string;
    cast?: Array<{ npc_ref: string }>;
    slices?: string[];
    i18n?: Record<string, { name?: string; synopsis?: string }>;
    [key: string]: any; // Allow custom fields
  };
  created_at: string;
  updated_at: string;
}

const defaultAdventureTemplate = {
  id: "adv.new_adventure",
  name: "New Adventure",
  version: "1.0.0",
  world_ref: "world.mystika@1.0.0",
  synopsis: "A new adventure begins...",
  cast: [
    { npc_ref: "npc.companion@1.0.0" }
  ],
  slices: ["core", "combat"],
  i18n: {
    es: { 
      name: "Nueva Aventura",
      synopsis: "Una nueva aventura comienza..."
    },
    fr: { 
      name: "Nouvelle Aventure",
      synopsis: "Une nouvelle aventure commence..."
    }
  }
};

export default function AwfAdventuresAdmin() {
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAdventure, setEditingAdventure] = useState<Adventure | null>(null);
  const [jsonEditor, setJsonEditor] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('list');

  // Load adventures
  const loadAdventures = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/awf/adventures');
      const data = await response.json();
      
      if (data.ok) {
        setAdventures(data.data || []);
      } else {
        setError(data.error || 'Failed to load adventures');
      }
    } catch (err) {
      setError('Failed to load adventures');
    } finally {
      setLoading(false);
    }
  };

  // Save adventure
  const saveAdventure = async (adventure: Adventure) => {
    try {
      const response = await fetch('/api/admin/awf/adventures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: adventure.id,
          version: adventure.version,
          doc: adventure.doc
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        await loadAdventures();
        setEditingAdventure(null);
        // setSelectedAdventure(null);
        setActiveTab('list');
      } else {
        setError(data.error || 'Failed to save adventure');
      }
    } catch (err) {
      setError('Failed to save adventure');
    }
  };

  // Delete adventure
  const deleteAdventure = async (id: string, version: string) => {
    if (!confirm('Are you sure you want to delete this adventure?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/awf/adventures/${id}/${version}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.ok) {
        await loadAdventures();
        // setSelectedAdventure(null);
      } else {
        setError(data.error || 'Failed to delete adventure');
      }
    } catch (err) {
      setError('Failed to delete adventure');
    }
  };

  // Validate JSON
  const validateJson = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      const errors: string[] = [];
      
      if (!parsed.id || typeof parsed.id !== 'string') {
        errors.push('Missing required field: id');
      }
      if (!parsed.name || typeof parsed.name !== 'string') {
        errors.push('Missing required field: name');
      }
      if (!parsed.version || typeof parsed.version !== 'string') {
        errors.push('Missing required field: version');
      }
      if (!parsed.world_ref || typeof parsed.world_ref !== 'string') {
        errors.push('Missing required field: world_ref');
      }
      
      // Check cast length
      if (parsed.cast && Array.isArray(parsed.cast) && parsed.cast.length > 12) {
        errors.push(`Cast has ${parsed.cast.length} NPCs, exceeds recommended limit of 12`);
      }
      
      // Check for large custom fields
      Object.keys(parsed).forEach(key => {
        if (!['id', 'name', 'version', 'world_ref', 'synopsis', 'cast', 'slices', 'i18n'].includes(key)) {
          const value = parsed[key];
          if (typeof value === 'object' && value !== null) {
            const serialized = JSON.stringify(value);
            if (serialized.length > 2048) {
              errors.push(`Custom field '${key}' exceeds 2KB (${Math.round(serialized.length/1024)}KB)`);
            }
          }
        }
      });
      
      setValidationErrors(errors);
      return errors.length === 0;
    } catch (err) {
      setValidationErrors(['Invalid JSON format']);
      return false;
    }
  };

  // Handle JSON editor changes
  const handleJsonChange = (value: string) => {
    setJsonEditor(value);
    validateJson(value);
  };

  // Create new adventure
  const createNewAdventure = () => {
    const newAdventure: Adventure = {
      id: `adv.new_${Date.now()}`,
      version: '1.0.0',
      doc: defaultAdventureTemplate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setEditingAdventure(newAdventure);
    setJsonEditor(JSON.stringify(newAdventure.doc, null, 2));
    setActiveTab('editor');
  };

  // Edit adventure
  const editAdventure = (adventure: Adventure) => {
    setEditingAdventure(adventure);
    setJsonEditor(JSON.stringify(adventure.doc, null, 2));
    setActiveTab('editor');
  };

  // Save from JSON editor
  const saveFromJson = () => {
    if (!validateJson(jsonEditor)) {
      return;
    }

    if (!editingAdventure) {
      return;
    }

    try {
      const parsedDoc = JSON.parse(jsonEditor);
      const updatedAdventure = {
        ...editingAdventure,
        doc: parsedDoc
      };
      
      saveAdventure(updatedAdventure);
    } catch (err) {
      setError('Failed to parse JSON');
    }
  };

  // Export adventures
  const exportAdventures = () => {
    const dataStr = JSON.stringify(adventures, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'adventures.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import adventures
  const importAdventures = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          imported.forEach(adventure => {
            saveAdventure(adventure);
          });
        } else {
          saveAdventure(imported);
        }
      } catch (err) {
        setError('Failed to parse imported file');
      }
    };
    reader.readAsText(file);
  };

  // Filter adventures
  const filteredAdventures = adventures.filter(adventure => {
    const matchesSearch = !searchTerm || 
      adventure.doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      adventure.doc.world_ref.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  useEffect(() => {
    loadAdventures();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">AWF Adventures</h1>
          <p className="text-gray-600 mt-2">
            Adventures may include cast, slices, and i18n. Unknown keys are preserved.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={createNewAdventure} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Adventure
          </Button>
          <Button onClick={exportAdventures} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={importAdventures}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {error && (
        <Alert className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="editor">JSON Editor</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Search adventures..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex items-center gap-2"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredAdventures.map((adventure) => (
                  <Card key={`${adventure.id}@${adventure.version}`} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{adventure.doc.name}</h3>
                          <Badge variant="outline">{adventure.doc.world_ref}</Badge>
                        </div>
                        {adventure.doc.synopsis && (
                          <p className="text-sm text-gray-600 mb-2">{adventure.doc.synopsis}</p>
                        )}
                        <div className="flex gap-2 mb-2">
                          <Badge variant="outline">{adventure.id}@{adventure.version}</Badge>
                          {adventure.doc.slices?.map(slice => (
                            <Badge key={slice} variant="secondary">{slice}</Badge>
                          ))}
                        </div>
                        <div className="flex gap-4 text-sm text-gray-500">
                          {adventure.doc.cast && adventure.doc.cast.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {adventure.doc.cast.length} NPCs
                            </div>
                          )}
                          {adventure.doc.i18n && Object.keys(adventure.doc.i18n).length > 0 && (
                            <div className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {Object.keys(adventure.doc.i18n).join(', ')} locales
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {/* setSelectedAdventure(adventure); */}}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editAdventure(adventure)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteAdventure(adventure.id, adventure.version)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>JSON Editor</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={saveFromJson} disabled={validationErrors.length > 0}>
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setEditingAdventure(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {validationErrors.length > 0 && (
                <Alert className="mb-4">
                  <AlertDescription>
                    <ul>
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <Textarea
                value={jsonEditor}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder="Enter adventure JSON..."
                className="min-h-[500px] font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}