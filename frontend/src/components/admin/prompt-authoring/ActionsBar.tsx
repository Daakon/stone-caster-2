/**
 * Actions Bar Component
 * Buttons for Preview and Budget actions
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Calculator, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { trackAdminEvent } from '@/lib/admin-telemetry';

export interface ActionsBarProps {
  onPreview: () => void;
  onBudget: (maxTokens?: number) => void;
  isLoadingPreview: boolean;
  isLoadingBudget: boolean;
  hasContext: boolean;
  hasBudgetContext?: boolean; // Budget requires worldId + rulesetId
  contextId?: string; // For telemetry (e.g., npcId)
}

export function ActionsBar({
  onPreview,
  onBudget,
  isLoadingPreview,
  isLoadingBudget,
  hasContext,
  hasBudgetContext = true, // Default to true for backward compatibility
  contextId,
}: ActionsBarProps) {
  const [maxTokens, setMaxTokens] = useState<string>('8000');

  const handlePreview = async () => {
    // Telemetry will be enhanced by parent with context flags
    await trackAdminEvent('npc.promptAuthoring.preview.requested', {
      npcId: contextId,
    });
    onPreview();
  };

  const handleBudget = async () => {
    const tokens = maxTokens ? parseInt(maxTokens, 10) : undefined;
    if (tokens && (tokens < 50 || tokens > 1_000_000)) {
      return; // Validation handled by backend
    }
    // Telemetry will be enhanced by parent with context flags
    await trackAdminEvent('npc.promptAuthoring.budget.requested', {
      npcId: contextId,
      maxTokens: tokens,
    });
    onBudget(tokens);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          onClick={handlePreview}
          disabled={!hasContext || isLoadingPreview || isLoadingBudget}
          className="flex-1"
          aria-label="Generate preview"
        >
          {isLoadingPreview ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Preview
            </>
          )}
        </Button>
        <Button
          onClick={handleBudget}
          disabled={!hasBudgetContext || isLoadingPreview || isLoadingBudget}
          variant="outline"
          className="flex-1"
          title={!hasBudgetContext ? 'Budget requires World ID and Ruleset ID' : undefined}
          aria-label={!hasBudgetContext ? 'Budget requires World ID and Ruleset ID' : 'Generate budget report'}
        >
          {isLoadingBudget ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Budget
            </>
          )}
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxTokens">Max Tokens (for Budget)</Label>
        <Input
          id="maxTokens"
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          placeholder="8000"
          min={50}
          max={1000000}
        />
        <p className="text-xs text-muted-foreground">
          Token budget limit (50 - 1,000,000)
        </p>
      </div>
    </div>
  );
}

