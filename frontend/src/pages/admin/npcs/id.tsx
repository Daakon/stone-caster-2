/**
 * NPC Edit Page
 * Phase 6: NPC edit with tabs for Details, Segments, Bindings, Relationships
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Eye, AlertTriangle, Globe, Tag, Users, FileText, Link } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type NPC } from '@/services/admin.npcs';
import { npcSegmentsService, type NPCSegment } from '@/services/admin.npcSegments';
import { npcBindingsService, type NPCBinding } from '@/services/admin.npcBindings';
import { useAppRoles } from '@/admin/routeGuard';
import NpcForm from '@/admin/components/NpcForm';
import NpcTierEditor from '@/admin/components/NpcTierEditor';
import NpcBindingsTable from '@/admin/components/NpcBindingsTable';

export default function NPCEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const [npc, setNPC] = useState<NPC | null>(null);
  const [segments, setSegments] = useState<Record<number, NPCSegment[]>>({ 0: [], 1: [], 2: [], 3: [] });
  const [bindings, setBindings] = useState<NPCBinding[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      loadNPC();
    }
  }, [id]);

  const loadNPC = async () => {
    try {
      setLoading(true);
      const [npcData, segmentsData, bindingsData, relationshipsData] = await Promise.all([
        npcsService.getNPC(id!),
        loadSegments(),
        loadBindings(),
        loadRelationships()
      ]);

      if (!npcData) {
        toast.error('NPC not found');
        navigate('/admin/npcs');
        return;
      }

      setNPC(npcData);
      setSegments(segmentsData);
      setBindings(bindingsData);
      setRelationships(relationshipsData);
    } catch (error) {
      toast.error('Failed to load NPC');
      console.error('Error loading NPC:', error);
      navigate('/admin/npcs');
    } finally {
      setLoading(false);
    }
  };

  const loadSegments = async () => {
    if (!id) return { 0: [], 1: [], 2: [], 3: [] };
    
    try {
      const segmentsByTier = await npcSegmentsService.getNPCSegmentsByTier(id);
      return segmentsByTier;
    } catch (error) {
      console.error('Error loading segments:', error);
      return { 0: [], 1: [], 2: [], 3: [] };
    }
  };

  const loadBindings = async () => {
    if (!id) return [];
    
    try {
      const bindingsData = await npcBindingsService.listNPCBindings({ npcId: id });
      return bindingsData;
    } catch (error) {
      console.error('Error loading bindings:', error);
      return [];
    }
  };

  const loadRelationships = async () => {
    if (!id) return [];
    
    try {
      // This would typically query npc_relationships table
      // For now, return empty array as relationships are read-only
      return [];
    } catch (error) {
      console.error('Error loading relationships:', error);
      return [];
    }
  };

  const handleSave = async (updatedNPC: Partial<NPC>) => {
    if (!npc) return;

    try {
      const savedNPC = await npcsService.updateNPC(npc.id, updatedNPC);
      setNPC(savedNPC);
      setIsEditing(false);
      toast.success('NPC updated successfully');
    } catch (error) {
      toast.error('Failed to update NPC');
      console.error('Error updating NPC:', error);
    }
  };

  const handleSegmentChange = async () => {
    // Reload segments when they change
    const newSegments = await loadSegments();
    setSegments(newSegments);
  };

  const handleBindingChange = async () => {
    // Reload bindings when they change
    const newBindings = await loadBindings();
    setBindings(newBindings);
  };

  const canEdit = isModerator || isAdmin;
  const canView = isCreator || isModerator || isAdmin;

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You need appropriate permissions to view NPCs.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading NPC...</div>
      </div>
    );
  }

  if (!npc) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">NPC Not Found</h2>
          <p className="text-muted-foreground">
            The NPC you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/npcs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to NPCs
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{npc.name}</h1>
            <p className="text-muted-foreground">
              {npc.archetype && `${npc.archetype} • `}
              {npc.world_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? "outline" : "default"}
            >
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          )}
        </div>
      </div>

      {/* NPC Info */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">World</span>
              </div>
              <span className="text-sm text-muted-foreground">{npc.world_name}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Role Tags</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {npc.role_tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="font-medium">Created</span>
              <span className="text-sm text-muted-foreground">
                {new Date(npc.created_at).toLocaleString()}
              </span>
            </div>
            <div className="space-y-2">
              <span className="font-medium">Last Updated</span>
              <span className="text-sm text-muted-foreground">
                {new Date(npc.updated_at).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="bindings">Bindings</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <NpcForm
            npc={npc}
            onSave={handleSave}
            isEditing={isEditing}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <NpcTierEditor
            npcId={npc.id}
            segments={segments}
            onSegmentChange={handleSegmentChange}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="bindings" className="space-y-4">
          <NpcBindingsTable
            npcId={npc.id}
            bindings={bindings}
            onBindingChange={handleBindingChange}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>NPC Relationships</CardTitle>
              <CardDescription>
                Character relationships and social dynamics (read-only)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relationships.length > 0 ? (
                <div className="space-y-4">
                  {relationships.map((relationship, index) => (
                    <div key={index} className="p-4 border rounded-md">
                      <div className="font-medium">Relationship {index + 1}</div>
                      <div className="text-sm text-muted-foreground">
                        Trust: {relationship.trust || 'N/A'} • 
                        Warmth: {relationship.warmth || 'N/A'} • 
                        Respect: {relationship.respect || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4" />
                  <p>No relationships data available</p>
                  <p className="text-sm">Relationships are managed through gameplay</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
