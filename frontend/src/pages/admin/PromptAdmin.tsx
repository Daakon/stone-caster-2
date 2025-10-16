import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  Lock,
  Unlock,
  Copy,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminService } from '@/hooks/useAdminService';
import { type Prompt, type PromptStats, type UpdatePromptData } from '@/services/adminService';
import { testAdminApi } from '@/utils/testAdminApi';

const BASE_LAYER_OPTIONS = [
  'core',
  'world',
  'adventure',
  'adventure_start',
  'optional'
];

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  core: ['logic', 'output_rules', 'npc_agency', 'failsafes'],
  world: ['world_rules', 'world_npcs', 'world_events'],
  adventure: ['story_beats', 'encounters', 'adventure_npcs'],
  adventure_start: ['opening_state', 'intro', 'npc_snapshot'],
};

const TURN_STAGES = ['any', 'start', 'ongoing', 'end'];

export default function PromptAdmin() {
  const {
    isAdmin,
    isLoading,
    getPrompts,
    getPromptStats,
    validateDependencies,
    updatePrompt,
    deletePrompt,
    togglePromptActive,
    togglePromptLocked,
    formatJsonForDisplay
  } = useAdminService();
  
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [stats, setStats] = useState<PromptStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLayer, setFilterLayer] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [showMetadata, setShowMetadata] = useState(false);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [newDependency, setNewDependency] = useState('');
  const [dependencyValidation, setDependencyValidation] = useState<Array<{
    prompt_id: string;
    missing_dependencies: string[];
  }>>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<boolean>(false);

  function normaliseTag(value: string): string {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return '';
    }
    const slug = trimmed.replace(/[^a-z0-9_]+/g, '_');
    return slug.replace(/^_+|_+$/g, '').replace(/_{2,}/g, '_');
  }

  const metadataPreview = useMemo(() => {
    if (!editingPrompt) {
      return {};
    }

    const base: Record<string, any> = {
      ...(editingPrompt.metadata || {})
    };

    base.dependencies = [...dependencies];

    const normalisedCategory = normaliseTag(category);
    if (normalisedCategory) {
      base.category = normalisedCategory;
    } else {
      delete base.category;
    }

    const normalisedSubcategory = normaliseTag(subcategory);
    if (normalisedSubcategory) {
      base.subcategory = normalisedSubcategory;
    } else {
      delete base.subcategory;
    }

    return base;
  }, [editingPrompt, dependencies, category, subcategory]);

  const layerCategorySuggestions = useMemo(() => {
    if (!editingPrompt) {
      return [] as string[];
    }
    return CATEGORY_SUGGESTIONS[editingPrompt.layer] ?? [];
  }, [editingPrompt]);

  const layerOptions = useMemo(() => {
    const options = new Set<string>(BASE_LAYER_OPTIONS);
    prompts.forEach(prompt => {
      if (prompt.layer) {
        options.add(prompt.layer);
      }
    });
    if (editingPrompt?.layer) {
      options.add(editingPrompt.layer);
    }
    return Array.from(options);
  }, [prompts, editingPrompt]);

  // Load prompts and stats
  useEffect(() => {
    if (isAdmin && !isLoading) {
      // Test API connectivity first
      testAdminApi().then(result => {
        console.log('Admin API test result:', result);
      });
      
      loadPrompts();
      loadStats();
      loadDependencies();
    }
  }, [isAdmin, isLoading]);

  // Reload prompts when filters change
  useEffect(() => {
    if (isAdmin && !isLoading) {
      loadPrompts();
    }
  }, [searchTerm, filterLayer, filterActive, isAdmin, isLoading]);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await getPrompts({
        search: searchTerm,
        layer: filterLayer !== 'all' ? filterLayer : undefined,
        active: filterActive === 'active' ? true : filterActive === 'inactive' ? false : undefined
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to load prompts');
      }

      setPrompts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast.error("Failed to load prompts");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getPromptStats();
      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to load stats');
      }
      setStats(response.data || null);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadDependencies = async () => {
    try {
      const response = await validateDependencies();
      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to validate dependencies');
      }
      setDependencyValidation(response.data || []);
    } catch (error) {
      console.error('Error validating dependencies:', error);
    }
  };

  const startEdit = (prompt: Prompt) => {
    setEditingPrompt({ ...prompt });
    setIsEditing(true);
    setDependencies(prompt.metadata?.dependencies || []);
    setCategory(normaliseTag(prompt.metadata?.category ?? ''));
    setSubcategory(normaliseTag(prompt.metadata?.subcategory ?? ''));
    setValidationError(null);
    setValidationSuccess(false);
  };

  const cancelEdit = () => {
    setEditingPrompt(null);
    setIsEditing(false);
    setDependencies([]);
    setNewDependency('');
    setCategory('');
    setSubcategory('');
    setShowMetadata(false);
    setValidationError(null);
    setValidationSuccess(false);
  };

  const savePrompt = async () => {
    if (!editingPrompt) return;

    try {
      // Update metadata with dependencies and categorisation
      const updatedMetadata: Record<string, any> = {
        ...(editingPrompt.metadata || {}),
        dependencies: [...dependencies],
      };

      const trimmedCategory = normaliseTag(category);
      const trimmedSubcategory = normaliseTag(subcategory);

      if (trimmedCategory) {
        updatedMetadata.category = trimmedCategory;
      } else {
        delete updatedMetadata.category;
      }

      if (trimmedSubcategory) {
        updatedMetadata.subcategory = trimmedSubcategory;
      } else {
        delete updatedMetadata.subcategory;
      }

      const updateData: UpdatePromptData = {
        layer: editingPrompt.layer,
        world_slug: editingPrompt.world_slug,
        adventure_slug: editingPrompt.adventure_slug,
        scene_id: editingPrompt.scene_id,
        turn_stage: editingPrompt.turn_stage,
        sort_order: editingPrompt.sort_order,
        version: editingPrompt.version,
        content: editingPrompt.content,
        metadata: updatedMetadata,
        active: editingPrompt.active,
        locked: editingPrompt.locked
      };

      const response = await updatePrompt(editingPrompt.id, updateData);

      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to save prompt');
      }

      toast.success("Prompt updated successfully");

      await loadPrompts();
      await loadStats();
      cancelEdit();
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error("Failed to save prompt");
    }
  };

  const estimateTokens = (content: string): number => {
    if (!content) {
      return 0;
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(trimmed.length / 4));
  };

  const createNewPrompt = () => {
    const newPrompt: Prompt = {
      id: '',
      layer: 'core',
      turn_stage: 'any',
      sort_order: 0,
      version: '1.0.0',
      content: '',
      metadata: {},
      active: true,
      locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tokenCount: 0
    };
    startEdit(newPrompt);
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const response = await deletePrompt(id);

      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to delete prompt');
      }

      toast.success("Prompt deleted successfully");

      await loadPrompts();
      await loadStats();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error("Failed to delete prompt");
    }
  };

  const toggleActive = async (id: string) => {
    try {
      const response = await togglePromptActive(id);

      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to toggle prompt status');
      }

      await loadPrompts();
      await loadStats();
    } catch (error) {
      console.error('Error toggling active:', error);
      toast.error("Failed to toggle prompt status");
    }
  };

  const toggleLocked = async (id: string) => {
    try {
      const response = await togglePromptLocked(id);

      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to toggle lock status');
      }

      await loadPrompts();
      await loadStats();
    } catch (error) {
      console.error('Error toggling locked:', error);
      toast.error("Failed to toggle lock status");
    }
  };

  const addDependency = () => {
    if (newDependency.trim() && !dependencies.includes(newDependency.trim())) {
      setDependencies([...dependencies, newDependency.trim()]);
      setNewDependency('');
    }
  };

  const removeDependency = (index: number) => {
    setDependencies(dependencies.filter((_, i) => i !== index));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Content copied to clipboard");
  };

  const formatJson = (obj: any) => {
    return formatJsonForDisplay(obj ?? {});
  };

  // Content validation and formatting functions
  const validateContent = () => {
    if (!editingPrompt) return;
    
    const format = editingPrompt.metadata?.format;
    const content = editingPrompt.content;
    
    setValidationError(null);
    setValidationSuccess(false);
    
    try {
      switch (format) {
        case 'json':
          JSON.parse(content);
          setValidationSuccess(true);
          break;
        case 'markdown':
          // Basic markdown validation - check for common syntax
          if (content.includes('```') && (content.split('```').length - 1) % 2 !== 0) {
            throw new Error('Unclosed code block');
          }
          setValidationSuccess(true);
          break;
        case 'string':
          // String validation - just check it's not empty
          if (content.trim().length === 0) {
            throw new Error('String content cannot be empty');
          }
          setValidationSuccess(true);
          break;
        default:
          setValidationError('Please select a content format first');
          return;
      }
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  const minifyContent = () => {
    if (!editingPrompt) return;
    
    const format = editingPrompt.metadata?.format;
    const content = editingPrompt.content;
    
    try {
      switch (format) {
        case 'json':
          const parsed = JSON.parse(content);
          const minified = JSON.stringify(parsed);
          setEditingPrompt({
            ...editingPrompt,
            content: minified,
            tokenCount: estimateTokens(minified)
          });
          break;
        case 'markdown':
          // Basic markdown minification - remove extra whitespace
          const minifiedMarkdown = content
            .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove multiple empty lines
            .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
            .trim();
          setEditingPrompt({
            ...editingPrompt,
            content: minifiedMarkdown,
            tokenCount: estimateTokens(minifiedMarkdown)
          });
          break;
        case 'string':
          // String minification - just trim whitespace
          const trimmedString = content.trim();
          setEditingPrompt({
            ...editingPrompt,
            content: trimmedString,
            tokenCount: estimateTokens(trimmedString)
          });
          break;
        default:
          setValidationError('Please select a content format first');
          return;
      }
      toast.success('Content minified successfully');
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Minification failed');
    }
  };

  const formatContent = () => {
    if (!editingPrompt) return;
    
    const format = editingPrompt.metadata?.format;
    const content = editingPrompt.content;
    
    try {
      switch (format) {
        case 'json':
          const parsed = JSON.parse(content);
          const formatted = JSON.stringify(parsed, null, 2);
          setEditingPrompt({
            ...editingPrompt,
            content: formatted,
            tokenCount: estimateTokens(formatted)
          });
          break;
        case 'markdown':
          // Basic markdown formatting - ensure proper line breaks
          const formattedMarkdown = content
            .replace(/\n{3,}/g, '\n\n') // Limit to double line breaks
            .replace(/^\s+|\s+$/gm, '') // Trim each line
            .trim();
          setEditingPrompt({
            ...editingPrompt,
            content: formattedMarkdown,
            tokenCount: estimateTokens(formattedMarkdown)
          });
          break;
        case 'string':
          // String formatting - just ensure proper line breaks
          const formattedString = content
            .replace(/\n{3,}/g, '\n\n') // Limit to double line breaks
            .trim();
          setEditingPrompt({
            ...editingPrompt,
            content: formattedString,
            tokenCount: estimateTokens(formattedString)
          });
          break;
        default:
          setValidationError('Please select a content format first');
          return;
      }
      toast.success('Content formatted successfully');
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Formatting failed');
    }
  };

  // Server-side filtering is handled in loadPrompts
  const filteredPrompts = prompts;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Early return if not admin or still loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <span className="ml-2 text-destructive">Access Denied</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prompt Admin Panel</h1>
          <p className="text-muted-foreground">Manage production prompts and dependencies</p>
        </div>
        <Button onClick={createNewPrompt} className="gap-2">
          <Plus className="h-4 w-4" />
          New Prompt
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_prompts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active_prompts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Locked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.locked_prompts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Worlds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.worlds_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Dependency Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{dependencyValidation.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dependency Validation Alerts */}
      {dependencyValidation.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Dependency Issues Found:</strong> {dependencyValidation.length} prompt(s) have missing dependencies.
            <Button 
              variant="link" 
              className="p-0 h-auto ml-2"
              onClick={validateDependencies}
            >
              Re-validate
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="layer">Layer</Label>
              <Select value={filterLayer} onValueChange={setFilterLayer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Layers</SelectItem>
                  {layerOptions.map(layer => (
                    <SelectItem key={layer} value={layer}>{layer}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="active">Status</Label>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompts List */}
      <div className="space-y-4">
        {filteredPrompts.map((prompt) => (
          <Card key={prompt.id} className={prompt.active ? '' : 'opacity-60'}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={prompt.active ? 'default' : 'secondary'}>
                    {prompt.layer}
                  </Badge>
                  {prompt.world_slug && (
                    <Badge variant="outline">{prompt.world_slug}</Badge>
                  )}
                  {prompt.adventure_slug && (
                    <Badge variant="outline">{prompt.adventure_slug}</Badge>
                  )}
                  {prompt.locked && (
                    <Badge variant="destructive">Locked</Badge>
                  )}
                  {dependencyValidation.some(dep => dep.prompt_id === prompt.id) && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Missing Deps
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(prompt.id)}
                  >
                    {prompt.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleLocked(prompt.id)}
                  >
                    {prompt.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(prompt)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePrompt(prompt.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>Sort Order: {prompt.sort_order}</span>
                  <span>| Version: {prompt.version}</span>
                  <span>| Turn Stage: {prompt.turn_stage}</span>
                  <span>| Tokens: ~{prompt.tokenCount ?? estimateTokens(prompt.content)}</span>
                </div>
                <div className="max-h-32 overflow-hidden">
                  <pre className="text-sm whitespace-pre-wrap">{prompt.content}</pre>
                </div>
                {(prompt.metadata?.category || prompt.metadata?.subcategory) && (
                  <div className="flex flex-wrap gap-1">
                    {prompt.metadata?.category && (
                      <Badge variant="outline" className="text-xs">
                        Category: {prompt.metadata.category}
                      </Badge>
                    )}
                    {prompt.metadata?.subcategory && (
                      <Badge variant="outline" className="text-xs">
                        Subcategory: {prompt.metadata.subcategory}
                      </Badge>
                    )}
                  </div>
                )}
                {prompt.metadata?.dependencies && prompt.metadata.dependencies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prompt.metadata.dependencies.map((dep: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {dep}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Modal */}
      {isEditing && editingPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Prompt</CardTitle>
                <Button variant="outline" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              <Tabs defaultValue="basic" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="layer">Layer</Label>
                      <Select 
                        value={editingPrompt.layer} 
                        onValueChange={(value) => setEditingPrompt({...editingPrompt, layer: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {layerOptions.map(layer => (
                            <SelectItem key={layer} value={layer}>{layer}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="turn_stage">Turn Stage</Label>
                      <Select 
                        value={editingPrompt.turn_stage} 
                        onValueChange={(value) => setEditingPrompt({...editingPrompt, turn_stage: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TURN_STAGES.map(stage => (
                            <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="world_slug">World Slug</Label>
                      <Input
                        id="world_slug"
                        value={editingPrompt.world_slug || ''}
                        onChange={(e) => setEditingPrompt({...editingPrompt, world_slug: e.target.value || undefined})}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="adventure_slug">Adventure Slug</Label>
                      <Input
                        id="adventure_slug"
                        value={editingPrompt.adventure_slug || ''}
                        onChange={(e) => setEditingPrompt({...editingPrompt, adventure_slug: e.target.value || undefined})}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="scene_id">Scene ID</Label>
                      <Input
                        id="scene_id"
                        value={editingPrompt.scene_id || ''}
                        onChange={(e) => setEditingPrompt({...editingPrompt, scene_id: e.target.value || undefined})}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category (optional)</Label>
                      <Input
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(normaliseTag(e.target.value))}
                        placeholder="e.g. logic, output_rules"
                      />
                      {layerCategorySuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {layerCategorySuggestions.map((suggestion) => (
                            <Button
                              key={suggestion}
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() => setCategory(normaliseTag(suggestion))}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="subcategory">Subcategory (optional)</Label>
                      <Input
                        id="subcategory"
                        value={subcategory}
                        onChange={(e) => setSubcategory(normaliseTag(e.target.value))}
                        placeholder="e.g. world_rules.towns"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sort_order">Sort Order</Label>
                      <Input
                        id="sort_order"
                        type="number"
                        value={editingPrompt.sort_order}
                        onChange={(e) => setEditingPrompt({...editingPrompt, sort_order: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="version">Version</Label>
                      <Input
                        id="version"
                        value={editingPrompt.version}
                        onChange={(e) => setEditingPrompt({...editingPrompt, version: e.target.value})}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="active"
                          checked={editingPrompt.active}
                          onChange={(e) => setEditingPrompt({...editingPrompt, active: e.target.checked})}
                        />
                        <Label htmlFor="active">Active</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="locked"
                          checked={editingPrompt.locked}
                          onChange={(e) => setEditingPrompt({...editingPrompt, locked: e.target.checked})}
                        />
                        <Label htmlFor="locked">Locked</Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor="content">Prompt Content</Label>
                          <Textarea
                          id="content"
                          value={editingPrompt.content}
                          onChange={(e) => setEditingPrompt({
                            ...editingPrompt,
                            content: e.target.value,
                            tokenCount: estimateTokens(e.target.value)
                          })}
                          className="min-h-[300px] font-mono text-sm"
                          placeholder="Enter prompt content..."
                        />
                      </div>
                    </div>
                    
                    {/* File Format Type Selector */}
                    <div className="space-y-2">
                      <Label>Content Format</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={editingPrompt.metadata?.format === 'markdown' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditingPrompt({
                            ...editingPrompt,
                            metadata: {
                              ...editingPrompt.metadata,
                              format: 'markdown'
                            }
                          })}
                        >
                          Markdown
                        </Button>
                        <Button
                          variant={editingPrompt.metadata?.format === 'json' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditingPrompt({
                            ...editingPrompt,
                            metadata: {
                              ...editingPrompt.metadata,
                              format: 'json'
                            }
                          })}
                        >
                          JSON
                        </Button>
                        <Button
                          variant={editingPrompt.metadata?.format === 'string' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditingPrompt({
                            ...editingPrompt,
                            metadata: {
                              ...editingPrompt.metadata,
                              format: 'string'
                            }
                          })}
                        >
                          String
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
                      <span>Estimated tokens: ~{editingPrompt.tokenCount ?? estimateTokens(editingPrompt.content)}</span>
                      <span>Characters: {editingPrompt.content.length.toLocaleString()}</span>
                    </div>

                    {/* Format Validation and Actions */}
                    {editingPrompt.metadata?.format && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={validateContent}
                          >
                            Validate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={minifyContent}
                          >
                            Minify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={formatContent}
                          >
                            Format
                          </Button>
                        </div>
                        {validationError && (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {validationError}
                          </div>
                        )}
                        {validationSuccess && (
                          <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                            Content is valid
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="dependencies" className="space-y-4">
                  <div>
                    <Label>Dependencies</Label>
                    <div className="space-y-2">
                      {dependencies.map((dep, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Badge variant="outline">{dep}</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeDependency(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={newDependency}
                        onChange={(e) => setNewDependency(e.target.value)}
                        placeholder="Add dependency..."
                        onKeyPress={(e) => e.key === 'Enter' && addDependency()}
                      />
                      <Button onClick={addDependency} disabled={!newDependency.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="metadata" className="space-y-4">
                  <div>
                    <Label>Metadata (JSON)</Label>
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(formatJson(metadataPreview))}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMetadata(!showMetadata)}
                      >
                        {showMetadata ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {showMetadata && (
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-64">
                        {formatJson(metadataPreview)}
                      </pre>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button onClick={savePrompt}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Prompt
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
