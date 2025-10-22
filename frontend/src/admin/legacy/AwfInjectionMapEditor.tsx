import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Trash2, 
  Play, 
  GitCompare, 
  Save, 
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';

interface InjectionRule {
  from: string;
  to: string;
  skipIfEmpty?: boolean;
  fallback?: { ifMissing?: unknown };
  limit?: { units: "tokens"|"count"; max: number };
}

interface InjectionMap {
  id: string;
  version: string;
  label: string;
  doc: {
    rules: InjectionRule[];
    notes?: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DryRunResponse {
  bundlePreview: any;
  bytes: number;
  tokensEst: number;
}

interface BundleDiffResponse {
  diff: any;
  leftBytes: number;
  rightBytes: number;
  leftTokens: number;
  rightTokens: number;
  deltaBytes: number;
  deltaTokens: number;
}

const AwfInjectionMapEditor: React.FC = () => {
  const [injectionMaps, setInjectionMaps] = useState<InjectionMap[]>([]);
  const [selectedMap, setSelectedMap] = useState<InjectionMap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Editor state
  const [editingMap, setEditingMap] = useState<Partial<InjectionMap>>({
    id: '',
    version: '1.0.0',
    label: '',
    doc: { rules: [] }
  });
  
  // Dry run state
  const [dryRunResult, setDryRunResult] = useState<DryRunResponse | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  
  // Diff state
  const [diffResult, setDiffResult] = useState<BundleDiffResponse | null>(null);
  const [isDiffing, setIsDiffing] = useState(false);
  const [leftBundle, setLeftBundle] = useState<string>('');
  const [rightBundle, setRightBundle] = useState<string>('');

  // Load injection maps on mount
  useEffect(() => {
    loadInjectionMaps();
  }, []);

  const loadInjectionMaps = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/awf/injection-maps', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load injection maps');
      }
      
      const data = await response.json();
      setInjectionMaps(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load injection maps');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMap = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/awf/injection-maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editingMap)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save injection map');
      }
      
      setSuccess('Injection map saved successfully');
      setEditingMap({ id: '', version: '1.0.0', label: '', doc: { rules: [] } });
      await loadInjectionMaps();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save injection map');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateMap = async (id: string, version: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admin/awf/injection-maps/${id}/${version}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate injection map');
      }
      
      setSuccess('Injection map activated successfully');
      await loadInjectionMaps();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate injection map');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMap = async (id: string, version: string) => {
    if (!confirm('Are you sure you want to delete this injection map?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admin/awf/injection-maps/${id}/${version}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete injection map');
      }
      
      setSuccess('Injection map deleted successfully');
      await loadInjectionMaps();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete injection map');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDryRun = async () => {
    if (!selectedMap) return;
    
    try {
      setIsDryRunning(true);
      setError(null);
      
      const response = await fetch(`/api/admin/awf/injection-maps/${selectedMap.id}/${selectedMap.version}/dry-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          game_id: 'test-game',
          game_snapshot: { meta: { scenario_ref: 'test-scenario@1.0.0' } }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run dry-run');
      }
      
      const data = await response.json();
      setDryRunResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run dry-run');
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleBundleDiff = async () => {
    try {
      setIsDiffing(true);
      setError(null);
      
      const response = await fetch('/api/admin/awf/bundle-diff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          left: leftBundle,
          right: rightBundle
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run bundle diff');
      }
      
      const data = await response.json();
      setDiffResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run bundle diff');
    } finally {
      setIsDiffing(false);
    }
  };

  const addRule = () => {
    setEditingMap(prev => ({
      ...prev,
      doc: {
        ...prev.doc!,
        rules: [...(prev.doc?.rules || []), { from: '', to: '' }]
      }
    }));
  };

  const updateRule = (index: number, field: keyof InjectionRule, value: any) => {
    setEditingMap(prev => ({
      ...prev,
      doc: {
        ...prev.doc!,
        rules: prev.doc!.rules.map((rule, i) => 
          i === index ? { ...rule, [field]: value } : rule
        )
      }
    }));
  };

  const removeRule = (index: number) => {
    setEditingMap(prev => ({
      ...prev,
      doc: {
        ...prev.doc!,
        rules: prev.doc!.rules.filter((_, i) => i !== index)
      }
    }));
  };

  const validateJsonPointer = (pointer: string): boolean => {
    return pointer.startsWith('/');
  };

  const getJsonPointerSuggestions = (): string[] => {
    return [
      '/world/id',
      '/world/name',
      '/adventure/id',
      '/adventure/name',
      '/scenario/name',
      '/npcs/active',
      '/npcs/count',
      '/contract/id',
      '/contract/name'
    ];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Injection Map Editor</h1>
          <p className="text-muted-foreground">
            Manage versioned injection maps for bundle assembly
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setEditingMap({ id: '', version: '1.0.0', label: '', doc: { rules: [] } })}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Map
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="editor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="editor">Map Editor</TabsTrigger>
          <TabsTrigger value="maps">Existing Maps</TabsTrigger>
          <TabsTrigger value="dry-run">Dry Run</TabsTrigger>
          <TabsTrigger value="diff">Bundle Diff</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create/Edit Injection Map</CardTitle>
              <CardDescription>
                Define rules for mapping data into bundles using JSON Pointers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="id">ID</Label>
                  <Input
                    id="id"
                    value={editingMap.id || ''}
                    onChange={(e) => setEditingMap(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="e.g., im.default"
                  />
                </div>
                <div>
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    value={editingMap.version || ''}
                    onChange={(e) => setEditingMap(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="e.g., 1.0.0"
                  />
                </div>
                <div>
                  <Label htmlFor="label">Label</Label>
                  <Input
                    id="label"
                    value={editingMap.label || ''}
                    onChange={(e) => setEditingMap(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g., Default Injection Map"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={editingMap.doc?.notes || ''}
                  onChange={(e) => setEditingMap(prev => ({
                    ...prev,
                    doc: { ...prev.doc!, notes: e.target.value }
                  }))}
                  placeholder="Describe this injection map..."
                  rows={3}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Injection Rules</Label>
                  <Button onClick={addRule} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>

                <div className="space-y-4">
                  {editingMap.doc?.rules?.map((rule, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`from-${index}`}>From (Source Path)</Label>
                          <Input
                            id={`from-${index}`}
                            value={rule.from}
                            onChange={(e) => updateRule(index, 'from', e.target.value)}
                            placeholder="e.g., /world/name"
                          />
                          <div className="text-sm text-muted-foreground mt-1">
                            <Info className="w-3 h-3 inline mr-1" />
                            Suggestions: {getJsonPointerSuggestions().slice(0, 3).join(', ')}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`to-${index}`}>To (Target Path)</Label>
                          <Input
                            id={`to-${index}`}
                            value={rule.to}
                            onChange={(e) => updateRule(index, 'to', e.target.value)}
                            placeholder="e.g., /awf_bundle/world/name"
                          />
                          {!validateJsonPointer(rule.to) && rule.to && (
                            <div className="text-sm text-destructive mt-1">
                              Must start with /
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <Label htmlFor={`skipIfEmpty-${index}`}>Skip If Empty</Label>
                          <input
                            id={`skipIfEmpty-${index}`}
                            type="checkbox"
                            checked={rule.skipIfEmpty || false}
                            onChange={(e) => updateRule(index, 'skipIfEmpty', e.target.checked)}
                            className="ml-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`limitUnits-${index}`}>Limit Units</Label>
                          <select
                            id={`limitUnits-${index}`}
                            value={rule.limit?.units || ''}
                            onChange={(e) => updateRule(index, 'limit', {
                              ...rule.limit,
                              units: e.target.value as "tokens"|"count"
                            })}
                            className="ml-2 px-2 py-1 border rounded"
                          >
                            <option value="">No limit</option>
                            <option value="tokens">Tokens</option>
                            <option value="count">Count</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor={`limitMax-${index}`}>Max Value</Label>
                          <Input
                            id={`limitMax-${index}`}
                            type="number"
                            value={rule.limit?.max || ''}
                            onChange={(e) => updateRule(index, 'limit', {
                              ...rule.limit,
                              max: parseInt(e.target.value) || undefined
                            })}
                            placeholder="1000"
                            className="ml-2"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button
                          onClick={() => removeRule(index)}
                          size="sm"
                          variant="destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveMap} disabled={isLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save Map'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Existing Injection Maps</CardTitle>
              <CardDescription>
                Manage and activate injection maps
              </CardDescription>
            </CardHeader>
            <CardContent>
              {injectionMaps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No injection maps found
                </div>
              ) : (
                <div className="space-y-4">
                  {injectionMaps.map((map) => (
                    <Card key={`${map.id}@${map.version}`} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{map.label}</h3>
                            <Badge variant={map.is_active ? "default" : "secondary"}>
                              {map.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline">{map.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {map.id} • {map.doc.rules.length} rules
                          </p>
                          {map.doc.notes && (
                            <p className="text-sm text-muted-foreground">
                              {map.doc.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!map.is_active && (
                            <Button
                              onClick={() => handleActivateMap(map.id, map.version)}
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            onClick={() => setSelectedMap(map)}
                            size="sm"
                            variant="outline"
                          >
                            Select
                          </Button>
                          <Button
                            onClick={() => handleDeleteMap(map.id, map.version)}
                            size="sm"
                            variant="destructive"
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dry-run" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dry Run Bundle Build</CardTitle>
              <CardDescription>
                Test injection map with sample data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedMap ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedMap.label}</Badge>
                    <Badge variant="secondary">{selectedMap.version}</Badge>
                  </div>
                  
                  <Button
                    onClick={handleDryRun}
                    disabled={isDryRunning}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isDryRunning ? 'Running Dry Run...' : 'Run Dry Build'}
                  </Button>

                  {dryRunResult && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Dry Run Results</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Estimated Bytes</Label>
                            <div className="text-2xl font-bold">{dryRunResult.bytes.toLocaleString()}</div>
                          </div>
                          <div>
                            <Label>Estimated Tokens</Label>
                            <div className="text-2xl font-bold">{dryRunResult.tokensEst.toLocaleString()}</div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <Label>Bundle Preview</Label>
                          <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-64">
                            {JSON.stringify(dryRunResult.bundlePreview, null, 2)}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select an injection map to run a dry build
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bundle Diff</CardTitle>
              <CardDescription>
                Compare two bundles and see differences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="leftBundle">Left Bundle (JSON)</Label>
                  <Textarea
                    id="leftBundle"
                    value={leftBundle}
                    onChange={(e) => setLeftBundle(e.target.value)}
                    placeholder='{"world": {"id": "world1"}}'
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="rightBundle">Right Bundle (JSON)</Label>
                  <Textarea
                    id="rightBundle"
                    value={rightBundle}
                    onChange={(e) => setRightBundle(e.target.value)}
                    placeholder='{"world": {"id": "world2"}}'
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <Button
                onClick={handleBundleDiff}
                disabled={isDiffing || !leftBundle || !rightBundle}
                className="w-full"
              >
                <GitCompare className="w-4 h-4 mr-2" />
                {isDiffing ? 'Comparing...' : 'Compare Bundles'}
              </Button>

              {diffResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Diff Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Left Bundle</Label>
                        <div className="text-sm text-muted-foreground">
                          {diffResult.leftBytes.toLocaleString()} bytes • {diffResult.leftTokens.toLocaleString()} tokens
                        </div>
                      </div>
                      <div>
                        <Label>Right Bundle</Label>
                        <div className="text-sm text-muted-foreground">
                          {diffResult.rightBytes.toLocaleString()} bytes • {diffResult.rightTokens.toLocaleString()} tokens
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <Label>Delta</Label>
                      <div className="text-sm">
                        <span className={diffResult.deltaBytes >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {diffResult.deltaBytes >= 0 ? '+' : ''}{diffResult.deltaBytes.toLocaleString()} bytes
                        </span>
                        {' • '}
                        <span className={diffResult.deltaTokens >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {diffResult.deltaTokens >= 0 ? '+' : ''}{diffResult.deltaTokens.toLocaleString()} tokens
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Changes</Label>
                      <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-64">
                        {JSON.stringify(diffResult.diff, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AwfInjectionMapEditor;
