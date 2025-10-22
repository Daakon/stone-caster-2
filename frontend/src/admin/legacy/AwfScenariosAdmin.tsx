/**
 * AWF Scenarios Admin Page
 * Admin interface for managing scenarios (game startpoints)
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Search, Download, Upload, Trash2, Edit } from 'lucide-react';

interface Scenario {
  id: string;
  version: string;
  doc: {
    world_ref: string;
    adventure_ref?: string;
    is_public?: boolean;
    scenario: {
      display_name: string;
      synopsis?: string;
      start_scene: string;
      fixed_npcs?: Array<{ npc_ref: string }>;
      starting_party?: Array<{ npc_ref: string }>;
      starting_inventory?: Array<{ item_id: string; qty?: number }>;
      starting_resources?: Record<string, number>;
      starting_flags?: Record<string, boolean>;
      starting_objectives?: Array<{ id: string; label: string; status?: string }>;
      tags?: string[];
      slices?: string[];
      i18n?: Record<string, any>;
    };
  };
  created_at: string;
  updated_at: string;
}

const defaultScenarioTemplate = {
  world_ref: "world.mystika@1.0.0",
  adventure_ref: "adv.whispercross@1.0.0",
  scenario: {
    display_name: "Last Ember — Common Room",
    synopsis: "A busy inn evening with travelers and rumors.",
    start_scene: "inn.last_ember.common_room",
    fixed_npcs: [
      { npc_ref: "npc.kiera@1.0.0" },
      { npc_ref: "npc.tavern_keeper@1.0.0" }
    ],
    starting_party: [
      { npc_ref: "npc.kiera@1.0.0" }
    ],
    starting_flags: {
      has_room_key: false
    },
    tags: ["inn", "social", "low_combat"]
  }
};

export default function AwfScenariosAdmin() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWorld, setFilterWorld] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [jsonEditor, setJsonEditor] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load scenarios
  const loadScenarios = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/awf/scenarios');
      const data = await response.json();
      
      if (data.ok) {
        setScenarios(data.data || []);
      } else {
        setError(data.error || 'Failed to load scenarios');
      }
    } catch (err) {
      setError('Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  // Save scenario
  const saveScenario = async (scenario: Scenario) => {
    try {
      const response = await fetch('/api/admin/awf/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: scenario.id,
          version: scenario.version,
          doc: scenario.doc
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        await loadScenarios();
        setEditingScenario(null);
        setSelectedScenario(null);
      } else {
        setError(data.error || 'Failed to save scenario');
      }
    } catch (err) {
      setError('Failed to save scenario');
    }
  };

  // Delete scenario
  const deleteScenario = async (id: string, version: string) => {
    if (!confirm('Are you sure you want to delete this scenario?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/awf/scenarios/${id}/${version}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.ok) {
        await loadScenarios();
        setSelectedScenario(null);
      } else {
        setError(data.error || 'Failed to delete scenario');
      }
    } catch (err) {
      setError('Failed to delete scenario');
    }
  };

  // Validate JSON
  const validateJson = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      // Basic validation - in a real app, you'd use the Zod schema
      if (!parsed.world_ref || !parsed.scenario?.display_name || !parsed.scenario?.start_scene) {
        setValidationErrors(['Missing required fields: world_ref, scenario.display_name, scenario.start_scene']);
        return false;
      }
      setValidationErrors([]);
      return true;
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

  // Create new scenario
  const createNewScenario = () => {
    const newScenario: Scenario = {
      id: `scenario.new_${Date.now()}`,
      version: '1.0.0',
      doc: defaultScenarioTemplate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setEditingScenario(newScenario);
    setJsonEditor(JSON.stringify(newScenario.doc, null, 2));
  };

  // Edit scenario
  const editScenario = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setJsonEditor(JSON.stringify(scenario.doc, null, 2));
  };

  // Save from JSON editor
  const saveFromJson = () => {
    if (!validateJson(jsonEditor)) {
      return;
    }

    if (!editingScenario) {
      return;
    }

    try {
      const parsedDoc = JSON.parse(jsonEditor);
      const updatedScenario = {
        ...editingScenario,
        doc: parsedDoc
      };
      
      saveScenario(updatedScenario);
    } catch (err) {
      setError('Failed to parse JSON');
    }
  };

  // Export scenarios
  const exportScenarios = () => {
    const dataStr = JSON.stringify(scenarios, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'scenarios.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import scenarios
  const importScenarios = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          // Import multiple scenarios
          imported.forEach(scenario => {
            saveScenario(scenario);
          });
        } else {
          // Import single scenario
          saveScenario(imported);
        }
      } catch (err) {
        setError('Failed to parse imported file');
      }
    };
    reader.readAsText(file);
  };

  // Filter scenarios
  const filteredScenarios = scenarios.filter(scenario => {
    const matchesSearch = !searchTerm || 
      scenario.doc.scenario.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (scenario.doc.scenario.synopsis || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesWorld = !filterWorld || scenario.doc.world_ref.includes(filterWorld);
    const matchesTag = !filterTag || (scenario.doc.scenario.tags || []).includes(filterTag);
    
    return matchesSearch && matchesWorld && matchesTag;
  });

  useEffect(() => {
    loadScenarios();
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
        <h1 className="text-3xl font-bold">AWF Scenarios</h1>
        <div className="flex gap-2">
          <Button onClick={createNewScenario} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Scenario
          </Button>
          <Button onClick={exportScenarios} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={importScenarios}
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

      <Tabs defaultValue="list" className="w-full">
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
                    placeholder="Search scenarios..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex items-center gap-2"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="world-filter">World Filter</Label>
                  <Input
                    id="world-filter"
                    placeholder="Filter by world..."
                    value={filterWorld}
                    onChange={(e) => setFilterWorld(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="tag-filter">Tag Filter</Label>
                  <Input
                    id="tag-filter"
                    placeholder="Filter by tag..."
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredScenarios.map((scenario) => (
                  <Card key={`${scenario.id}@${scenario.version}`} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{scenario.doc.scenario.display_name}</h3>
                        <p className="text-sm text-gray-600">{scenario.doc.scenario.synopsis}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{scenario.id}@{scenario.version}</Badge>
                          <Badge variant="outline">{scenario.doc.world_ref}</Badge>
                          {scenario.doc.scenario.tags?.map(tag => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedScenario(scenario)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editScenario(scenario)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteScenario(scenario.id, scenario.version)}
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
                  <Button variant="outline" onClick={() => setEditingScenario(null)}>
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
              
              {/* Public Toggle */}
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-public"
                    checked={editingScenario?.doc.is_public ?? false}
                    onCheckedChange={(checked) => {
                      if (editingScenario) {
                        setEditingScenario({
                          ...editingScenario,
                          doc: {
                            ...editingScenario.doc,
                            is_public: checked
                          }
                        });
                      }
                    }}
                  />
                  <Label htmlFor="is-public" className="text-sm font-medium">
                    Public Scenario
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, this scenario will be visible to players in the scenario picker.
                </p>
              </div>
              
              <Textarea
                value={jsonEditor}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder="Enter scenario JSON..."
                className="min-h-[500px] font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
