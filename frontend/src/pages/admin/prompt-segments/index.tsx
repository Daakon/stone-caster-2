/**
 * Prompt Segments Admin Page
 * Phase 4: Global management of all prompt segment scopes
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Edit, Trash2, Copy, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { segmentsService, type PromptSegment, type SegmentFilters } from '@/services/admin.segments';
import { refsService, type RefItem } from '@/services/admin.refs';
import { useAppRoles } from '@/admin/routeGuard';
import { SegmentFormModal } from '@/admin/components/SegmentFormModal';
import { SegmentBulkBar } from '@/admin/components/SegmentBulkBar';

export default function PromptSegmentsAdmin() {
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const [segments, setSegments] = useState<PromptSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SegmentFilters>({});
  const [search, setSearch] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [showBulkBar, setShowBulkBar] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<PromptSegment | null>(null);
  const [availableLocales, setAvailableLocales] = useState<string[]>([]);
  const [refs, setRefs] = useState<{
    worlds: RefItem[];
    rulesets: RefItem[];
    entryPoints: RefItem[];
    npcs: RefItem[];
  }>({
    worlds: [],
    rulesets: [],
    entryPoints: [],
    npcs: []
  });

  // Load data
  useEffect(() => {
    loadSegments();
    loadLocales();
    loadRefs();
  }, [filters]);

  const loadSegments = async () => {
    try {
      setLoading(true);
      const response = await segmentsService.listSegments({
        ...filters,
        q: search || undefined
      });
      setSegments(response.data);
    } catch (error) {
      toast.error('Failed to load segments');
      console.error('Error loading segments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLocales = async () => {
    try {
      const locales = await segmentsService.getAvailableLocales();
      setAvailableLocales(locales);
    } catch (error) {
      console.error('Error loading locales:', error);
    }
  };

  const loadRefs = async () => {
    try {
      const [worlds, rulesets, entryPoints, npcs] = await Promise.all([
        refsService.getWorldsForFilter(),
        refsService.getRulesetsForFilter(),
        refsService.getEntryPointsForFilter(),
        refsService.getNPCsForFilter()
      ]);

      setRefs({ worlds, rulesets, entryPoints, npcs });
    } catch (error) {
      console.error('Error loading refs:', error);
    }
  };

  const handleCreateSegment = () => {
    setEditingSegment(null);
    setIsFormModalOpen(true);
  };

  const handleEditSegment = (segment: PromptSegment) => {
    setEditingSegment(segment);
    setIsFormModalOpen(true);
  };

  const handleDeleteSegment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) {
      return;
    }

    try {
      await segmentsService.deleteSegment(id);
      toast.success('Segment deleted successfully');
      loadSegments();
    } catch (error) {
      toast.error('Failed to delete segment');
      console.error('Error deleting segment:', error);
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await segmentsService.toggleSegmentActive(id);
      toast.success('Segment status updated');
      loadSegments();
    } catch (error) {
      toast.error('Failed to update segment');
      console.error('Error updating segment:', error);
    }
  };

  const handleCloneToLocale = async (segment: PromptSegment, locale: string) => {
    try {
      await segmentsService.cloneToLocale(segment.id, locale);
      toast.success(`Segment cloned to ${locale}`);
      loadSegments();
    } catch (error) {
      toast.error('Failed to clone segment');
      console.error('Error cloning segment:', error);
    }
  };

  const handleSelectSegment = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedSegments(prev => [...prev, id]);
      setShowBulkBar(true);
    } else {
      setSelectedSegments(prev => prev.filter(segmentId => segmentId !== id));
      if (selectedSegments.length === 1) {
        setShowBulkBar(false);
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSegments(segments.map(s => s.id));
      setShowBulkBar(true);
    } else {
      setSelectedSegments([]);
      setShowBulkBar(false);
    }
  };

  const getScopeBadge = (scope: string) => {
    const variants = {
      core: 'default',
      ruleset: 'secondary',
      world: 'outline',
      entry: 'destructive',
      entry_start: 'destructive',
      npc: 'secondary',
      game_state: 'outline',
      player: 'outline',
      rng: 'outline',
      input: 'outline'
    } as const;

    return (
      <Badge variant={variants[scope as keyof typeof variants] || 'outline'}>
        {scope.replace('_', ' ')}
      </Badge>
    );
  };

  const getLocaleBadge = (locale?: string) => {
    if (!locale) return null;
    return <Badge variant="outline" className="text-xs">{locale}</Badge>;
  };

  const getRefName = (segment: PromptSegment) => {
    if (segment.scope === 'core') return 'N/A';
    
    const refList = {
      world: refs.worlds,
      ruleset: refs.rulesets,
      entry: refs.entryPoints,
      entry_start: refs.entryPoints,
      npc: refs.npcs
    };

    const items = refList[segment.scope as keyof typeof refList] || [];
    const item = items.find(r => r.id === segment.ref_id);
    return item?.name || segment.ref_id;
  };

  const canEditSegment = (segment: PromptSegment) => {
    // Creators can only edit entry/entry_start segments for their own entries
    if (isCreator) {
      return segment.scope === 'entry' || segment.scope === 'entry_start';
    }
    // Moderators and admins can edit all segments
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prompt Segments</h1>
          <p className="text-muted-foreground">
            Manage modular, versioned pieces of prompt content across all scopes
          </p>
        </div>
        <Button onClick={handleCreateSegment}>
          <Plus className="mr-2 h-4 w-4" />
          Create Segment
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search segments..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Select
                value={filters.scope?.[0] || ''}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    scope: value ? [value] : undefined 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All scopes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All scopes</SelectItem>
                  <SelectItem value="core">Core</SelectItem>
                  <SelectItem value="ruleset">Ruleset</SelectItem>
                  <SelectItem value="world">World</SelectItem>
                  <SelectItem value="entry">Entry</SelectItem>
                  <SelectItem value="entry_start">Entry Start</SelectItem>
                  <SelectItem value="npc">NPC</SelectItem>
                  <SelectItem value="game_state">Game State</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="rng">RNG</SelectItem>
                  <SelectItem value="input">Input</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="active">Status</Label>
              <Select
                value={filters.active === undefined ? '' : filters.active.toString()}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    active: value === '' ? undefined : value === 'true'
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locale">Locale</Label>
              <Select
                value={filters.locale || ''}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    locale: value || undefined 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All locales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All locales</SelectItem>
                  {availableLocales.map(locale => (
                    <SelectItem key={locale} value={locale}>
                      {locale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {showBulkBar && (
        <SegmentBulkBar
          selectedCount={selectedSegments.length}
          onBulkActivate={() => {
            segmentsService.bulkToggleActive(selectedSegments, true);
            setSelectedSegments([]);
            setShowBulkBar(false);
            loadSegments();
          }}
          onBulkDeactivate={() => {
            segmentsService.bulkToggleActive(selectedSegments, false);
            setSelectedSegments([]);
            setShowBulkBar(false);
            loadSegments();
          }}
          onBulkExport={() => {
            segmentsService.exportSegments(selectedSegments).then(data => {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `segments-export-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            });
          }}
          onClose={() => {
            setSelectedSegments([]);
            setShowBulkBar(false);
          }}
        />
      )}

      {/* Segments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Segments ({segments.length})</CardTitle>
          <CardDescription>
            Manage prompt segments across all scopes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSegments.length === segments.length && segments.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Locale</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment) => (
                  <TableRow key={segment.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSegments.includes(segment.id)}
                        onCheckedChange={(checked) => handleSelectSegment(segment.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {segment.id}
                    </TableCell>
                    <TableCell>
                      {getScopeBadge(segment.scope)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {getRefName(segment)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{segment.version}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {segment.active ? (
                          <ToggleRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm">
                          {segment.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getLocaleBadge(segment.metadata.locale)}
                    </TableCell>
                    <TableCell>
                      {new Date(segment.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {canEditSegment(segment) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSegment(segment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(segment.id)}
                        >
                          {segment.active ? 'Deactivate' : 'Activate'}
                        </Button>

                        {segment.metadata.locale && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCloneToLocale(segment, 'en')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}

                        {canEditSegment(segment) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSegment(segment.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Modal */}
      <SegmentFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSegment(null);
        }}
        segment={editingSegment}
        onSave={() => {
          setIsFormModalOpen(false);
          setEditingSegment(null);
          loadSegments();
        }}
      />
    </div>
  );
}