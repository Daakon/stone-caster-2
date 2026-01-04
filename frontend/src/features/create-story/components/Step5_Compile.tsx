/**
 * Step 5: Compile (Bind)
 * Review and compile screen for the Story Creation wizard
 * 
 * Features:
 * - Summary cards for each step
 * - Compile button with loading state
 * - Success feedback
 */

import React from 'react';
import { Check, Sparkles, BookOpen, Users, Scroll, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { updateStoryDraft, bindStory } from '@/services/chimera-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { toast } from 'sonner';

export function Step5_Compile() {
  const draft = useStoryDraftStore((state) => state.draft);
  const isLoading = useStoryDraftStore((state) => state.isLoading);
  const error = useStoryDraftStore((state) => state.error);
  const compile = useStoryDraftStore((state) => state.compile);
  const updateMetadata = useStoryDraftStore((state) => state.updateMetadata);

  const metadata = draft?.metadata || {
    title: '',
    summary: '',
    genre_tags: [],
    safety_filters: [],
    ruleset_keys: [],
    image_url: '',
  };

  const handleMetadataChange = (field: keyof typeof metadata, value: any) => {
    updateMetadata({ [field]: value });
  };

  const stagedEntityCount = draft?.staged_entity_ids.length || 0;
  const stagedLoreCount = draft?.staged_lore_ids.length || 0;
  const rulesetCount = metadata.ruleset_keys.length;

  const navigate = useNavigate();

  const handleCompile = async () => {
    if (!draft) return;

    try {
      // 1. Ensure latest state is saved including entities and status
      await updateStoryDraft(draft.draft_id, {
        display_name: metadata.title,
        description: metadata.summary,
        // Ensure entity_ids are synced from staged
        entity_ids: draft.staged_entity_ids,
        status: 'bound'
      });

      // 2. Trigger compilation (Binding)
      await bindStory(draft.draft_id);

      // 3. Show success toast
      toast.success('Story Bound!', {
        description: 'Your story has been successfully compiled and is now in your library.',
        duration: 5000,
      });

      // 4. Navigate to My Creations
      navigate('/my-creations');

    } catch (error: any) {
      console.error('[Step5_Compile] Failed to bind story:', error);
      toast.error('Failed to bind story', {
        description: error.message || 'Unknown error occurred'
      });
    }
  };

  const isCompiling = isLoading && draft?.is_saving;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">The Binding</h2>
        <p className="text-muted-foreground">
          Review your story configuration and compile it into a playable experience.
        </p>
      </div>

      {/* Story Identity (Editable) */}
      <Card className="border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Story Identity</CardTitle>
          <CardDescription>Finalize how this story will appear in your library</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="The Last Light of Aetheria"
                  value={metadata.title}
                  onChange={(e) => handleMetadataChange('title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Short Description</Label>
                <Textarea
                  id="summary"
                  placeholder="Brief summary..."
                  className="min-h-[100px] resize-none"
                  value={metadata.summary}
                  onChange={(e) => handleMetadataChange('summary', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <ImageUploader
                folder="stories"
                onUploadComplete={(url) => handleMetadataChange('image_url', url)}
                className="w-full"
              />
              {metadata.image_url && (
                <div className="mt-2 relative rounded-md overflow-hidden aspect-video border border-border">
                  <img
                    src={metadata.image_url}
                    alt="Cover Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Forces Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Forces</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rulesetCount}</p>
            <CardDescription>
              {rulesetCount === 1 ? 'Active Ruleset' : 'Active Rulesets'}
            </CardDescription>
          </CardContent>
        </Card>

        {/* Elements Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Elements</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stagedEntityCount}</p>
            <CardDescription>
              {stagedEntityCount === 1 ? 'Entity recruited' : 'Entities recruited'}
            </CardDescription>
          </CardContent>
        </Card>

        {/* Lore Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Scroll className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Lore</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stagedLoreCount}</p>
            <CardDescription>
              {stagedLoreCount === 1 ? 'Lore fragment' : 'Lore fragments'}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Action Area */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Ready to Compile</CardTitle>
          <CardDescription>
            Once compiled, your story will be ready to play. You can always edit it later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-3 p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-destructive mb-1">Compilation Failed</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleCompile}
            disabled={isCompiling || !metadata.title.trim()}
            className="w-full min-h-[56px] text-lg"
            size="lg"
          >
            {isCompiling ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Compiling...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Bind Fate
              </>
            )}
          </Button>
          {!metadata.title.trim() && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Please add a title to your story before compiling.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
