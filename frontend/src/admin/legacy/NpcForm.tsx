/**
 * NPC Form Component
 * Phase 6: Form for editing NPC details with portrait upload
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Upload, X, AlertTriangle, Globe, Tag, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type NPC } from '@/services/admin.npcs';
import NpcPortraitUploader from './NpcPortraitUploader';

const npcFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  archetype: z.string().optional(),
  role_tags: z.array(z.string()).default([]),
  doc: z.record(z.any()).default({})
});

type NPCFormData = z.infer<typeof npcFormSchema>;

interface NpcFormProps {
  npc: NPC;
  onSave: (updatedNPC: Partial<NPC>) => Promise<void>;
  isEditing: boolean;
  canEdit: boolean;
}

export default function NpcForm({ npc, onSave, isEditing, canEdit }: NpcFormProps) {
  const [roleTags, setRoleTags] = useState<string[]>(npc.role_tags || []);
  const [newTag, setNewTag] = useState('');
  const [docJson, setDocJson] = useState(JSON.stringify(npc.doc || {}, null, 2));
  const [docError, setDocError] = useState<string | null>(null);
  const [portraitUrl, setPortraitUrl] = useState<string | undefined>(npc.portrait_url);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch
  } = useForm<NPCFormData>({
    resolver: zodResolver(npcFormSchema),
    defaultValues: {
      name: npc.name,
      archetype: npc.archetype || '',
      role_tags: npc.role_tags || [],
      doc: npc.doc || {}
    }
  });

  const watchedValues = watch();

  // Update form when NPC changes
  useEffect(() => {
    setValue('name', npc.name);
    setValue('archetype', npc.archetype || '');
    setValue('role_tags', npc.role_tags || []);
    setValue('doc', npc.doc || {});
    setRoleTags(npc.role_tags || []);
    setDocJson(JSON.stringify(npc.doc || {}, null, 2));
    setPortraitUrl(npc.portrait_url);
  }, [npc, setValue]);

  const handleAddTag = () => {
    if (newTag.trim() && !roleTags.includes(newTag.trim())) {
      const updatedTags = [...roleTags, newTag.trim()];
      setRoleTags(updatedTags);
      setValue('role_tags', updatedTags);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = roleTags.filter(tag => tag !== tagToRemove);
    setRoleTags(updatedTags);
    setValue('role_tags', updatedTags);
  };

  const handleDocChange = (value: string) => {
    setDocJson(value);
    try {
      const parsed = JSON.parse(value);
      setValue('doc', parsed);
      setDocError(null);
    } catch (error) {
      setDocError('Invalid JSON format');
    }
  };

  const handlePortraitUpload = async (file: File) => {
    try {
      const url = await npcsService.updatePortrait(npc.id, file);
      setPortraitUrl(url);
      toast.success('Portrait uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload portrait');
      console.error('Error uploading portrait:', error);
    }
  };

  const onSubmit = async (data: NPCFormData) => {
    try {
      await onSave({
        name: data.name,
        archetype: data.archetype,
        role_tags: data.role_tags,
        doc: data.doc,
        portrait_url: portraitUrl
      });
    } catch (error) {
      console.error('Error saving NPC:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>NPC Details</CardTitle>
        <CardDescription>
          {isEditing ? 'Edit NPC information' : 'View NPC information'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name')}
                disabled={!isEditing}
                placeholder="Enter NPC name"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="archetype">Archetype</Label>
              <Input
                id="archetype"
                {...register('archetype')}
                disabled={!isEditing}
                placeholder="e.g., Mentor, Villain, Companion"
              />
            </div>
          </div>

          {/* Portrait Upload */}
          <div className="space-y-2">
            <Label>Portrait</Label>
            <NpcPortraitUploader
              currentUrl={portraitUrl}
              onUpload={handlePortraitUpload}
              disabled={!isEditing}
            />
          </div>

          {/* Role Tags */}
          <div className="space-y-2">
            <Label>Role Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                disabled={!isEditing}
                placeholder="Add role tag"
              />
              {isEditing && (
                <Button type="button" onClick={handleAddTag} disabled={!newTag.trim()}>
                  Add
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {roleTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* JSON Document */}
          <div className="space-y-2">
            <Label htmlFor="doc">Character Document (JSON)</Label>
            <Textarea
              id="doc"
              value={docJson}
              onChange={(e) => handleDocChange(e.target.value)}
              disabled={!isEditing}
              rows={10}
              className="font-mono text-sm"
              placeholder="Enter character details as JSON..."
            />
            {docError && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{docError}</AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">
              Include character details like personality, backstory, abilities, etc.
            </p>
          </div>

          {/* World Information (Read-only) */}
          <div className="space-y-2">
            <Label>World</Label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{npc.world_name}</span>
            </div>
          </div>

          {/* Form Actions */}
          {isEditing && (
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting || !!docError}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}

          {!canEdit && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You don't have permission to edit this NPC. Contact an administrator for access.
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}




