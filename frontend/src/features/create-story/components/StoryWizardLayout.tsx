/**
 * Story Wizard Layout
 * Shell component for the Story Creation (Casting Circle) editor
 * 
 * Features:
 * - Top bar with title and draft status
 * - Tab-based navigation (non-linear)
 * - Tabs: World | Forces | Elements | Lore | Bind
 */

import React from 'react';
import { Save, AlertTriangle, Check } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface StoryWizardLayoutProps {
  children: React.ReactNode;
}

const TAB_STEPS = [
  { id: 0, label: 'World' },
  { id: 1, label: 'Forces' },
  { id: 2, label: 'Elements' },
  { id: 3, label: 'Lore' },
  { id: 4, label: 'Bind' },
] as const;

export function StoryWizardLayout({ children }: StoryWizardLayoutProps) {
  const draft = useStoryDraftStore((state) => state.draft);
  const setStep = useStoryDraftStore((state) => state.setStep);
  const currentStep = draft?.current_step ?? 0;
  const isSaving = draft?.is_saving ?? false;
  const isDirty = draft?.is_dirty ?? false;
  const hasWorldSelected = !!draft?.metadata.world_preset_id;

  const handleTabChange = (value: string) => {
    const step = parseInt(value, 10);
    // World tab (0) is always accessible
    // Other tabs require a world to be selected
    if (step === 0 || hasWorldSelected) {
      setStep(step);
    }
  };

  // Draft status badge
  const getStatusBadge = () => {
    if (isSaving) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Save className="h-3 w-3 mr-1" />
          Saving...
        </Badge>
      );
    }
    if (isDirty) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Unsaved
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <Check className="h-3 w-3 mr-1" />
        Saved
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Casting Circle</h1>
            {getStatusBadge()}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4">
          <Tabs value={String(currentStep)} onValueChange={handleTabChange}>
            <TabsList className="w-full h-auto p-1 bg-transparent justify-start overflow-x-auto scrollbar-thin">
              {TAB_STEPS.map((tab) => {
                const isDisabled = tab.id > 0 && !hasWorldSelected;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={String(tab.id)}
                    disabled={isDisabled}
                    className={cn(
                      'min-h-[44px] px-4 py-2 data-[state=active]:bg-background',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                    title={isDisabled ? 'Select a world first' : undefined}
                  >
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {children}
        </div>
      </main>
    </div>
  );
}
