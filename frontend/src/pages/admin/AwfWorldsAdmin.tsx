/**
 * AWF Worlds Admin Page (Flexible)
 * Admin interface for managing worlds with flexible schemas
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
import { Loader2, Plus, Download, Upload, Trash2, Edit, Globe, Clock } from 'lucide-react';

interface World {
  id: string;
  version: string;
  doc: {
    id: string;
    name: string;
    version: string;
    timeworld?: {
      timezone: string;
      calendar: string;
      seasons?: string[];
    };
    slices?: string[];
    i18n?: Record<string, { name?: string }>;
    [key: string]: any; // Allow custom fields
  };
  created_at: string;
  updated_at: string;
}

const defaultWorldTemplate = {
  id: "world.new_world",
  name: "New World",
  version: "1.0.0",
  timeworld: {
    timezone: "UTC",
    calendar: "gregorian",
    seasons: ["spring", "summer", "autumn", "winter"]
  },
  slices: ["core", "magic"],
  i18n: {
    es: { name: "Mundo Nuevo" },
    fr: { name: "Monde Nouveau" }
  }
};

export default function AwfWorldsAdmin() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingWorld, setEditingWorld] = useState<World | null>(null);
  const [jsonEditor, setJsonEditor] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('list');

  // Load worlds
  const loadWorlds = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/awf/worlds');
      const data = await response.json();
      
      if (data.ok) {
        setWorlds(data.data || []);
      } else {
        setError(data.error || 'Failed to load worlds');
      }
    } catch (err) {
      setError('Failed to load worlds');
    } finally {
      setLoading(false);
    }
  };

  // Save world
  const saveWorld = async (world: World) => {
    try {
      const response = await fetch('/api/admin/awf/worlds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: world.id,
          version: world.version,
          doc: world.doc
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        await loadWorlds();
        setEditingWorld(null);
        // setSelectedWorld(null);
        setActiveTab('list');
      } else {
        setError(data.error || 'Failed to save world');
      }
    } catch (err) {
      setError('Failed to save world');
    }
  };

  // Delete world
  const deleteWorld = async (id: string, version: string) => {
    if (!confirm('Are you sure you want to delete this world?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/awf/worlds/${id}/${version}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.ok) {
        await loadWorlds();
        // setSelectedWorld(null);
      } else {
        setError(data.error || 'Failed to delete world');
      }
    } catch (err) {
      setError('Failed to delete world');
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
      
      // Check for large custom fields
      Object.keys(parsed).forEach(key => {
        if (!['id', 'name', 'version', 'timeworld', 'slices', 'i18n'].includes(key)) {
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

  // Create new world
  const createNewWorld = () => {
    const newWorld: World = {
      id: `world.new_${Date.now()}`,
      version: '1.0.0',
      doc: defaultWorldTemplate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setEditingWorld(newWorld);
    setJsonEditor(JSON.stringify(newWorld.doc, null, 2));
    setActiveTab('editor');
  };

  // Edit world
  const editWorld = (world: World) => {
    setEditingWorld(world);
    setJsonEditor(JSON.stringify(world.doc, null, 2));
    setActiveTab('editor');
  };

  // Save from JSON editor
  const saveFromJson = () => {
    if (!validateJson(jsonEditor)) {
      return;
    }

    if (!editingWorld) {
      return;
    }

    try {
      const parsedDoc = JSON.parse(jsonEditor);
      const updatedWorld = {
        ...editingWorld,
        doc: parsedDoc
      };
      
      saveWorld(updatedWorld);
    } catch (err) {
      setError('Failed to parse JSON');
    }
  };

  // Export worlds
  const exportWorlds = () => {
    const dataStr = JSON.stringify(worlds, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'worlds.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import worlds
  const importWorlds = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          imported.forEach(world => {
            saveWorld(world);
          });
        } else {
          saveWorld(imported);
        }
      } catch (err) {
        setError('Failed to parse imported file');
      }
    };
    reader.readAsText(file);
  };

  // Filter worlds
  const filteredWorlds = worlds.filter(world => {
    const matchesSearch = !searchTerm || 
      world.doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  useEffect(() => {
    loadWorlds();
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
          <h1 className="text-3xl font-bold">AWF Worlds</h1>
          <p className="text-gray-600 mt-2">
            Worlds may include custom keys; known fields validate strictly. Optional: timeworld, slices, i18n.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={createNewWorld} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New World
          </Button>
          <Button onClick={exportWorlds} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={importWorlds}
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
                    placeholder="Search worlds..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex items-center gap-2"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredWorlds.map((world) => (
                  <Card key={`${world.id}@${world.version}`} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{world.doc.name}</h3>
                          {world.doc.timeworld && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {world.doc.timeworld.timezone}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 mb-2">
                          <Badge variant="outline">{world.id}@{world.version}</Badge>
                          {world.doc.slices?.map(slice => (
                            <Badge key={slice} variant="secondary">{slice}</Badge>
                          ))}
                        </div>
                        {world.doc.i18n && Object.keys(world.doc.i18n).length > 0 && (
                          <div className="flex gap-1">
                            <Globe className="h-3 w-3 text-gray-500" />
                            <span className="text-sm text-gray-500">
                              {Object.keys(world.doc.i18n).join(', ')} locales
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {/* setSelectedWorld(world); */}}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editWorld(world)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteWorld(world.id, world.version)}
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
                  <Button variant="outline" onClick={() => setEditingWorld(null)}>
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
                placeholder="Enter world JSON..."
                className="min-h-[500px] font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}