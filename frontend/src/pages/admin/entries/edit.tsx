/**
 * Entry Editor Page
 * Edit entry with World, Rulesets, and NPC associations
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

import { entriesService, type Entry } from '@/services/admin.entries';
import { worldsService, type World } from '@/services/admin.worlds';
import { rulesetsService, type Ruleset } from '@/services/admin.rulesets';
import { npcsService, type NPC } from '@/services/admin.npcs';
import { npcPacksService, type NPCPack } from '@/services/admin.npcPacks';
import { entryLinksService } from '@/services/admin.entryLinks';
import { NamedSinglePicker, type NamedEntity } from '@/admin/components/NamedSinglePicker';
import { NamedMultiPicker } from '@/admin/components/NamedMultiPicker';

const entrySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  status: z.enum(['draft', 'active', 'archived']),
  world_id: z.string().min(1, 'World is required')
});

type EntryFormData = z.infer<typeof entrySchema>;

export default function EntryEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = id !== 'new';

  const [entry, setEntry] = useState<Entry | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [npcs, setNPCs] = useState<NPC[]>([]);
  const [npcPacks, setNPCPacks] = useState<NPCPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedRulesetIds, setSelectedRulesetIds] = useState<string[]>([]);
  const [selectedNPCIds, setSelectedNPCIds] = useState<string[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'draft',
      world_id: ''
    }
  });

  const watchedName = watch('name');

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load all reference data
        const [worldsData, rulesetsData, npcsData, packsData] = await Promise.all([
          worldsService.getActiveWorlds(),
          rulesetsService.listRulesets({ status: 'active' }, 1, 100).then(r => r.data),
          npcsService.getActiveNPCs(),
          npcPacksService.getActiveNPCPacks()
        ]);

        setWorlds(worldsData);
        setRulesets(rulesetsData);
        setNPCs(npcsData);
        setNPCPacks(packsData);

        // Load entry if editing
        if (isEditing && id) {
          const entryData = await entriesService.getEntry(id);
          setEntry(entryData);
          
          // Populate form
          setValue('name', entryData.name);
          setValue('description', entryData.description || '');
          setValue('status', entryData.status);
          setValue('world_id', entryData.world_id);

          // Load associations
          setSelectedRulesetIds(entryData.rulesets?.map(r => r.id) || []);
          setSelectedNPCIds(entryData.npcs?.map(n => n.id) || []);
          setSelectedPackIds(entryData.npc_packs?.map(p => p.id) || []);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load entry data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, isEditing, setValue]);

  const handleFormSubmit = async (data: EntryFormData) => {
    try {
      setSaving(true);

      if (isEditing && id) {
        // Update existing entry
        await entriesService.updateEntry(id, data);
        await entryLinksService.updateEntryAssociations(id, {
          rulesetIds: selectedRulesetIds,
          npcIds: selectedNPCIds,
          packIds: setSelectedPackIds
        });
        toast.success('Entry updated successfully');
      } else {
        // Create new entry
        const newEntry = await entriesService.createEntry(data);
        await entryLinksService.updateEntryAssociations(newEntry.id, {
          rulesetIds: selectedRulesetIds,
          npcIds: selectedNPCIds,
          packIds: setSelectedPackIds
        });
        toast.success('Entry created successfully');
        navigate(`/admin/entries/${newEntry.id}/edit`);
      }
    } catch (error) {
      console.error('Failed to save entry:', error);
      toast.error('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !id) return;

    if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      return;
    }

    try {
      await entriesService.deleteEntry(id);
      toast.success('Entry deleted successfully');
      navigate('/admin/entries');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading entry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/entries')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Entries
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditing ? 'Edit Entry' : 'Create Entry'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update entry details and associations' : 'Create a new entry with world and ruleset associations'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isEditing && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button
            onClick={handleSubmit(handleFormSubmit)}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : (isEditing ? 'Update Entry' : 'Create Entry')}
          </Button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic Information */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Core details for this entry
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="Enter entry name"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Brief description of the entry..."
                    rows={4}
                    className={errors.description ? 'border-red-500' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={watch('status')}
                    onValueChange={(value) => setValue('status', value as 'draft' | 'active' | 'archived')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="world_id">World *</Label>
                  <NamedSinglePicker
                    value={watch('world_id')}
                    onValueChange={(value) => setValue('world_id', value)}
                    placeholder="Select a world..."
                    items={worlds.map(w => ({ id: w.id, name: w.name, description: w.description }))}
                    className={errors.world_id ? 'border-red-500' : ''}
                  />
                  {errors.world_id && (
                    <p className="text-sm text-red-600 mt-1">{errors.world_id.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Associations */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="rulesets" className="space-y-4">
              <TabsList>
                <TabsTrigger value="rulesets">Rulesets</TabsTrigger>
                <TabsTrigger value="npcs">NPCs</TabsTrigger>
                <TabsTrigger value="packs">NPC Packs</TabsTrigger>
              </TabsList>

              <TabsContent value="rulesets">
                <Card>
                  <CardHeader>
                    <CardTitle>Ruleset Associations</CardTitle>
                    <CardDescription>
                      Select and order rulesets for this entry. The order matters for prompt assembly.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NamedMultiPicker
                      value={selectedRulesetIds}
                      onValueChange={setSelectedRulesetIds}
                      placeholder="Select rulesets..."
                      items={rulesets.map(r => ({ id: r.id, name: r.name, description: r.description }))}
                      allowReorder={true}
                      onReorder={(reorderedIds) => {
                        setSelectedRulesetIds(reorderedIds);
                      }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="npcs">
                <Card>
                  <CardHeader>
                    <CardTitle>Individual NPCs</CardTitle>
                    <CardDescription>
                      Select individual NPCs that will be available in this entry.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NamedMultiPicker
                      value={selectedNPCIds}
                      onValueChange={setSelectedNPCIds}
                      placeholder="Select NPCs..."
                      items={npcs.map(n => ({ id: n.id, name: n.name, description: n.description }))}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="packs">
                <Card>
                  <CardHeader>
                    <CardTitle>NPC Packs</CardTitle>
                    <CardDescription>
                      Select NPC packs that will be available in this entry.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NamedMultiPicker
                      value={selectedPackIds}
                      onValueChange={setSelectedPackIds}
                      placeholder="Select NPC packs..."
                      items={npcPacks.map(p => ({ id: p.id, name: p.name, description: p.description }))}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </form>
    </div>
  );
}
