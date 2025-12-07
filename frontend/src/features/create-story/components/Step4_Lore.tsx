/**
 * Step 4: Lore (Whispers)
 * Notebook view for managing lore fragments in the story
 * 
 * Features:
 * - Display staged lore fragments
 * - Add lore via LoreManagerModal
 * - Remove lore from notebook
 */

import React, { useState, useEffect } from 'react';
import { Plus, X, BookOpen } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { LoreManagerModal } from './LoreManagerModal';
import type { LoreFragment } from '../data/mock-library';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function Step4_Lore() {
  const draft = useStoryDraftStore((state) => state.draft);
  const stageLore = useStoryDraftStore((state) => state.stageLore);
  const unstageLore = useStoryDraftStore((state) => state.unstageLore);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localLore, setLocalLore] = useState<LoreFragment[]>([]);

  const stagedLoreIds = draft?.staged_lore_ids || [];

  // Sync local lore with staged IDs
  useEffect(() => {
    // In a real app, we'd fetch lore by ID from the backend
    // For now, we maintain local state and sync IDs to store
    setLocalLore((prev) =>
      prev.filter((lore) => stagedLoreIds.includes(lore.id))
    );
  }, [stagedLoreIds]);

  // Handle lore selection from library
  const handleSelectLore = (lore: LoreFragment) => {
    // Add to local state if not already present
    setLocalLore((prev) => {
      if (prev.some((l) => l.id === lore.id)) {
        return prev;
      }
      return [...prev, lore];
    });

    // Stage in store
    stageLore(lore.id);
  };

  // Handle lore creation
  const handleCreateLore = (lore: LoreFragment) => {
    // Add to local state
    setLocalLore((prev) => [...prev, lore]);

    // Stage in store
    stageLore(lore.id);
  };

  // Handle lore removal
  const handleRemoveLore = (loreId: string) => {
    // Remove from local state
    setLocalLore((prev) => prev.filter((l) => l.id !== loreId));

    // Unstage from store
    unstageLore(loreId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Lore</h2>
        <p className="text-muted-foreground">
          Add lore fragments to enrich your world. These whispers of knowledge will inform the narrative and guide the story.
        </p>
      </div>

      {/* Empty State */}
      {localLore.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">The notebook is empty</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Start building your world's lore by adding your first fragment.
            </p>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="min-h-[44px] min-w-[160px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Lore
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lore List */}
      {localLore.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Lore Fragments ({localLore.length})
            </h3>
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="outline"
              className="min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Lore
            </Button>
          </div>

          <div className="space-y-3">
            {localLore.map((lore) => (
              <Card key={lore.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        {lore.title}
                      </CardTitle>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveLore(lore.id)}
                      className="rounded-full hover:bg-muted p-1.5 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                      aria-label={`Remove ${lore.title}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="whitespace-pre-wrap">
                    {lore.content}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Lore Manager Modal */}
      <LoreManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelectLore}
        onCreate={handleCreateLore}
      />
    </div>
  );
}
