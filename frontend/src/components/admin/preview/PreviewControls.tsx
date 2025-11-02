/**
 * Preview Controls Component
 * Slider + toggles + selects for preview configuration
 */

import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';

export interface PreviewControlsProps {
  defaultBudget: number;
  defaultWarnPct: number;
  entryPointId: string;
  onParamsChange: (params: {
    budget?: number;
    warnPct?: number;
    npcLimit?: number;
    includeNpcs: boolean;
    entryStartSlug?: string;
    qa?: boolean;
  }) => void;
  disabled?: boolean;
}

export function PreviewControls({
  defaultBudget,
  defaultWarnPct,
  entryPointId,
  onParamsChange,
  disabled = false,
}: PreviewControlsProps) {
  const storageKey = `sc.preview.${entryPointId}`;

  // Load from localStorage
  const loadStored = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }, [storageKey]);

  // Save to localStorage
  const saveStored = useCallback((params: any) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(params));
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  const stored = loadStored();
  const [budget, setBudget] = useState<number>(stored?.budget ?? defaultBudget);
  const [warnPct, setWarnPct] = useState<number>(stored?.warnPct ?? defaultWarnPct);
  const [npcLimit, setNpcLimit] = useState<number | ''>(stored?.npcLimit ?? '');
  const [includeNpcs, setIncludeNpcs] = useState<boolean>(stored?.includeNpcs !== false);
  const [entryStartSlug, setEntryStartSlug] = useState<string>(stored?.entryStartSlug || '');
  const [qa, setQa] = useState<boolean>(stored?.qa === true);

  // Budget slider (25% - 200% of default)
  const minBudget = Math.floor(defaultBudget * 0.25);
  const maxBudget = Math.floor(defaultBudget * 2);
  const budgetPct = Math.round((budget / defaultBudget) * 100);

  // Debounced update
  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = {
        budget: budget !== defaultBudget ? budget : undefined,
        warnPct: warnPct !== defaultWarnPct ? warnPct : undefined,
        npcLimit: npcLimit !== '' ? Number(npcLimit) : undefined,
        includeNpcs,
        entryStartSlug: entryStartSlug || undefined,
        qa,
      };
      
      saveStored(params);
      onParamsChange(params);
    }, 300);

    return () => clearTimeout(timeout);
  }, [budget, warnPct, npcLimit, includeNpcs, entryStartSlug, qa, defaultBudget, defaultWarnPct, onParamsChange, saveStored]);

  const resetToDefaults = () => {
    setBudget(defaultBudget);
    setWarnPct(defaultWarnPct);
    setNpcLimit('');
    setIncludeNpcs(true);
    setEntryStartSlug('');
    setQa(false);
    localStorage.removeItem(storageKey);
  };

  return (
    <div className="space-y-6 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Preview Controls</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToDefaults}
          aria-label="Reset to defaults"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Budget Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="budget-slider">Budget: {budget} tokens ({budgetPct}%)</Label>
          <span className="text-sm text-muted-foreground">{minBudget} - {maxBudget}</span>
        </div>
        <Slider
          id="budget-slider"
          min={minBudget}
          max={maxBudget}
          step={100}
          value={[budget]}
          onValueChange={([value]) => setBudget(value)}
          disabled={disabled}
          aria-label="Token budget"
        />
      </div>

      {/* Warn Percentage */}
      <div className="space-y-2">
        <Label htmlFor="warn-pct">Warning Threshold: {(warnPct * 100).toFixed(0)}%</Label>
        <Slider
          id="warn-pct"
          min={0.5}
          max={1.0}
          step={0.05}
          value={[warnPct]}
          onValueChange={([value]) => setWarnPct(value)}
          disabled={disabled}
          aria-label="Warning percentage"
        />
      </div>

      {/* NPC Limit */}
      <div className="space-y-2">
        <Label htmlFor="npc-limit">NPC Cap (pre-trim)</Label>
        <Input
          id="npc-limit"
          type="number"
          min={0}
          placeholder="No limit"
          value={npcLimit}
          onChange={(e) => setNpcLimit(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={disabled}
          aria-label="NPC limit"
        />
      </div>

      {/* Include NPCs Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="include-npcs">Include NPCs</Label>
        <Switch
          id="include-npcs"
          checked={includeNpcs}
          onCheckedChange={setIncludeNpcs}
          disabled={disabled}
          aria-label="Include NPCs"
        />
      </div>

      {/* Entry Start Slug */}
      <div className="space-y-2">
        <Label htmlFor="entry-start-slug">Entry Start Slug (optional)</Label>
        <Input
          id="entry-start-slug"
          type="text"
          placeholder="Leave empty for default"
          value={entryStartSlug}
          onChange={(e) => setEntryStartSlug(e.target.value)}
          disabled={disabled}
          aria-label="Entry start slug"
        />
      </div>

      {/* QA Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="qa-toggle">Include QA Report</Label>
        <Switch
          id="qa-toggle"
          checked={qa}
          onCheckedChange={setQa}
          disabled={disabled}
          aria-label="Include QA report"
        />
      </div>
    </div>
  );
}

