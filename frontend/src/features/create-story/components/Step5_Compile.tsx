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
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function Step5_Compile() {
  const draft = useStoryDraftStore((state) => state.draft);
  const isLoading = useStoryDraftStore((state) => state.isLoading);
  const error = useStoryDraftStore((state) => state.error);
  const compile = useStoryDraftStore((state) => state.compile);

  const metadata = draft?.metadata || {
    title: '',
    summary: '',
    genre_tags: [],
    safety_filters: [],
    ruleset_keys: [],
  };

  const stagedEntityCount = draft?.staged_entity_ids.length || 0;
  const stagedLoreCount = draft?.staged_lore_ids.length || 0;
  const rulesetCount = metadata.ruleset_keys.length;

  const handleCompile = async () => {
    if (!draft) return;

    try {
      // Compile story using store action
      const compiledStory = await compile();

      // Show success toast
      toast.success('Story Compiled!', {
        description: 'Your story has been successfully compiled and is ready to play.',
        duration: 5000,
      });

      // In a real app, we'd navigate to the story detail page or dashboard
      // For now, we'll just show the success state
      console.log('[Step5_Compile] Compiled story:', compiledStory);
    } catch (error) {
      // Error is already set in the store, toast will be handled by error display
      console.error('[Step5_Compile] Failed to compile story:', error);
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

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* World Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">World</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="font-semibold text-lg">
                {metadata.title || 'Untitled Story'}
              </p>
              {metadata.genre_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {metadata.genre_tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                Compile Story
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
