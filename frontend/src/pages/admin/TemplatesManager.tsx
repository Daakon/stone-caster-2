/**
 * Templates Manager Admin Page
 * List, detail, and editor for slot templates
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Eye, 
  Save, 
  AlertTriangle,
  CheckCircle,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppRoles } from '@/admin/routeGuard';
import { api } from '@/lib/api';

type SlotType = 'world' | 'ruleset' | 'npc' | 'scenario' | 'module' | 'ux';

interface Template {
  id: string;
  type: SlotType;
  slot: string;
  version: number;
  body: string;
  status: 'draft' | 'published';
  created_at: string;
  created_by?: string;
}

interface TemplateHistory {
  version: number;
  status: 'draft' | 'published';
  created_at: string;
  created_by?: string;
}

interface LintWarning {
  type: string;
  severity: 'error' | 'warning';
  message: string;
  template?: {
    type: SlotType;
    slot: string;
    version: number;
  };
}

export default function TemplatesManager() {
  const { isAdmin } = useAppRoles();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<SlotType | 'all'>('all');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [editorBody, setEditorBody] = useState('');
  const [previewWarnings, setPreviewWarnings] = useState<LintWarning[]>([]);
  const [activeTab, setActiveTab] = useState<string>('list');

  // Read type query parameter from URL on mount
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const slotParam = searchParams.get('slot');
    
    if (typeParam && ['world', 'ruleset', 'npc', 'scenario', 'module', 'ux'].includes(typeParam)) {
      setSelectedType(typeParam as SlotType);
    }
    
    if (slotParam) {
      setSelectedSlot(slotParam);
    }
  }, [searchParams]);

  // Fetch active templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin', 'templates', 'active', selectedType],
    queryFn: async () => {
      const url = selectedType === 'all' 
        ? '/api/admin/templates/active'
        : `/api/admin/templates/active?type=${selectedType}`;
      const res = await api.get(url);
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.data as Template[];
    },
  });

  // Fetch template history
  const { data: history } = useQuery({
    queryKey: ['admin', 'templates', 'history', selectedType, selectedSlot],
    queryFn: async () => {
      if (!selectedType || !selectedSlot || selectedType === 'all') return [];
      const res = await api.get(`/api/admin/templates/${selectedType}/${selectedSlot}/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.data as TemplateHistory[];
    },
    enabled: !!selectedSlot && selectedType !== 'all',
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async ({ type, slot, body, baseVersion }: { type: SlotType; slot: string; body: string; baseVersion?: number }) => {
      const res = await api.post('/api/admin/templates/publish', {
        type,
        slot,
        body,
        baseVersion,
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(`Rate limit exceeded. ${res.data?.retryAfter ? `Retry after ${Math.ceil(res.data.retryAfter / 60)} minutes` : 'Please try again later.'}`);
        }
        throw new Error(res.error || 'Failed to publish');
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success('Template published successfully');
      // Invalidate cache to force refresh
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates', 'active'] });
      setEditorBody('');
      setSelectedSlot(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to publish template');
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async ({ type, slot, body }: { type: SlotType; slot: string; body: string }) => {
      const res = await api.post('/api/admin/prompt-preview', {
        worldId: 'preview-world',
        rulesetId: 'preview-ruleset',
        templatesVersion: undefined,
      });
      if (!res.ok) throw new Error('Failed to preview');
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewWarnings(data.warnings || []);
      toast.success('Preview generated');
    },
    onError: () => {
      toast.error('Failed to generate preview');
    },
  });

  // Group templates by type and slot
  const groupedTemplates = templates?.reduce((acc, template) => {
    const key = `${template.type}:${template.slot}`;
    if (!acc[key]) {
      acc[key] = {
        type: template.type,
        slot: template.slot,
        latest: template,
        draftCount: 0,
      };
    }
    if (template.status === 'draft') {
      acc[key].draftCount++;
    }
    return acc;
  }, {} as Record<string, { type: SlotType; slot: string; latest: Template; draftCount: number }>) || {};

  const handlePreview = () => {
    if (!selectedType || !selectedSlot || selectedType === 'all' || !editorBody) {
      toast.error('Please select a template and enter body text');
      return;
    }
    previewMutation.mutate({
      type: selectedType,
      slot: selectedSlot,
      body: editorBody,
    });
  };

  const handlePublish = () => {
    if (!selectedType || !selectedSlot || selectedType === 'all' || !editorBody) {
      toast.error('Please select a template and enter body text');
      return;
    }
    const latest = groupedTemplates[`${selectedType}:${selectedSlot}`]?.latest;
    publishMutation.mutate({
      type: selectedType,
      slot: selectedSlot,
      body: editorBody,
      baseVersion: latest?.version,
    });
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Admin access required</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Templates Manager</h1>
        <p className="text-muted-foreground">
          Manage slot templates for prompt rendering
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>
                <Select value={selectedType} onValueChange={(v) => setSelectedType(v as SlotType | 'all')}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="world">World</SelectItem>
                    <SelectItem value="ruleset">Ruleset</SelectItem>
                    <SelectItem value="npc">NPC</SelectItem>
                    <SelectItem value="scenario">Scenario</SelectItem>
                    <SelectItem value="module">Module</SelectItem>
                    <SelectItem value="ux">UX</SelectItem>
                  </SelectContent>
                </Select>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Latest Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Draft Count</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(groupedTemplates).map((group) => (
                      <TableRow key={`${group.type}:${group.slot}`}>
                        <TableCell>{group.type}</TableCell>
                        <TableCell>{group.slot}</TableCell>
                        <TableCell>v{group.latest.version}</TableCell>
                        <TableCell>
                          <Badge variant={group.latest.status === 'published' ? 'default' : 'secondary'}>
                            {group.latest.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{group.draftCount}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedType(group.type);
                              setSelectedSlot(group.slot);
                              setEditorBody(group.latest.body);
                              setActiveTab('editor'); // Switch to editor tab
                            }}
                          >
                            <History className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Editor</CardTitle>
              <CardDescription>
                {selectedSlot ? `Editing ${selectedType}.${selectedSlot}` : 'Select a template to edit'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select 
                    value={selectedType === 'all' ? '' : selectedType} 
                    onValueChange={(v) => setSelectedType(v as SlotType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="world">World</SelectItem>
                      <SelectItem value="ruleset">Ruleset</SelectItem>
                      <SelectItem value="npc">NPC</SelectItem>
                      <SelectItem value="scenario">Scenario</SelectItem>
                      <SelectItem value="module">Module</SelectItem>
                      <SelectItem value="ux">UX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Slot</Label>
                  <Input
                    value={selectedSlot || ''}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    placeholder="Enter slot name"
                  />
                </div>
              </div>

              <div>
                <Label>Template Body (Mustache)</Label>
                <Textarea
                  value={editorBody}
                  onChange={(e) => setEditorBody(e.target.value)}
                  placeholder="Enter template body with Mustache variables..."
                  rows={10}
                  className="font-mono"
                />
              </div>

              {previewWarnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {previewWarnings.map((w, i) => (
                        <div key={i} className="text-sm">
                          {w.severity === 'error' ? '❌' : '⚠️'} {w.message}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 items-center">
                <Button onClick={handlePreview} disabled={!selectedSlot || !editorBody}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button 
                  onClick={handlePublish} 
                  disabled={!selectedSlot || !editorBody || publishMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Publish
                </Button>
                <div className="text-sm text-muted-foreground ml-4">
                  Rate limit: 10 publishes/hour
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedSlot && history && (
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Created By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.version}>
                        <TableCell>v{h.version}</TableCell>
                        <TableCell>
                          <Badge variant={h.status === 'published' ? 'default' : 'secondary'}>
                            {h.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(h.created_at).toLocaleString()}</TableCell>
                        <TableCell>{h.created_by || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Available Extras Drawer */}
          {selectedType && selectedType !== 'all' && (
            <Card>
              <CardHeader>
                <CardTitle>Available Extras</CardTitle>
                <CardDescription>
                  Fields available for use in templates ({'{'}extras.KEY{'}'})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AvailableExtrasList packType={selectedType} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AvailableExtrasList({ packType }: { packType: SlotType }) {
  const { data: fields } = useQuery({
    queryKey: ['admin', 'field-defs', packType, 'active'],
    queryFn: async () => {
      const res = await api.get(`/api/admin/field-defs?packType=${packType}&status=active`);
      if (!res.ok) return [];
      return res.data as Array<{
        key: string;
        label: string;
        schema_json: Record<string, unknown>;
        default_json: unknown;
      }>;
    },
  });

  if (!fields || fields.length === 0) {
    return <p className="text-sm text-muted-foreground">No extras defined for {packType}</p>;
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div key={field.key} className="border rounded p-2">
          <div className="font-mono text-xs text-primary">{`{{extras.${field.key}}}`}</div>
          <div className="text-sm text-muted-foreground">{field.label}</div>
          {field.default_json && (
            <div className="text-xs text-muted-foreground mt-1">
              Default: {JSON.stringify(field.default_json)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

