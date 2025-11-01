/**
 * Phase 5: PromptMetaBar - Display prompt assembly metadata and policy
 * Shows included/dropped pieces, token estimates, and policy actions
 */

import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { TurnMeta } from '../../lib/types';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface PromptMetaBarProps {
  meta: TurnMeta | null | undefined;
  className?: string;
}

export function PromptMetaBar({ meta, className }: PromptMetaBarProps) {
  if (!meta) {
    return null;
  }

  const tokenPct = (meta.tokenEst?.pct || 0) * 100;
  const hasPolicyWarnings = meta.policy && meta.policy.length > 0;
  const hasDropped = meta.dropped && meta.dropped.length > 0;

  // Group included pieces by scope
  const includedByScope: Record<string, number> = {};
  meta.included?.forEach((piece) => {
    const [scope] = piece.split(':');
    includedByScope[scope] = (includedByScope[scope] || 0) + 1;
  });

  // Group dropped pieces by scope
  const droppedByScope: Record<string, number> = {};
  meta.dropped?.forEach((piece) => {
    const [scope] = piece.split(':');
    droppedByScope[scope] = (droppedByScope[scope] || 0) + 1;
  });

  return (
    <Card className={className} role="region" aria-label="Prompt assembly metadata">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Prompt Assembly</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Token Usage</span>
            <span className="font-mono">
              {Math.round(meta.tokenEst.input)} / {meta.tokenEst.budget} ({tokenPct.toFixed(1)}%)
            </span>
          </div>
          <Progress value={tokenPct} className="h-2" />
          {tokenPct > 90 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Approaching token budget limit
            </p>
          )}
        </div>

        {/* Included Pieces by Scope */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Included Pieces</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(includedByScope).map(([scope, count]) => (
              <Badge
                key={scope}
                variant="secondary"
                className="text-xs"
                aria-label={`${scope} scope: ${count} pieces`}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                {scope}: {count}
              </Badge>
            ))}
          </div>
        </div>

        {/* Policy Actions */}
        {hasPolicyWarnings && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Policy Actions</div>
            <div className="flex flex-wrap gap-2">
              {meta.policy?.map((action) => {
                let variant: 'default' | 'destructive' | 'secondary' = 'secondary';
                let Icon = AlertTriangle;
                let label = action;

                if (action.includes('DROPPED')) {
                  variant = 'destructive';
                  Icon = XCircle;
                } else if (action.includes('UNDECIDED')) {
                  variant = 'secondary';
                  Icon = AlertTriangle;
                }

                // Human-readable labels
                if (action === 'SCENARIO_DROPPED') {
                  label = 'Scenario dropped';
                } else if (action === 'NPC_DROPPED') {
                  label = 'NPC trimmed';
                } else if (action === 'SCENARIO_POLICY_UNDECIDED') {
                  label = 'Budget warn';
                }

                return (
                  <Badge
                    key={action}
                    variant={variant}
                    className="text-xs flex items-center gap-1"
                    aria-label={action}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Dropped Pieces */}
        {hasDropped && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-destructive">Dropped Pieces</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(droppedByScope).map(([scope, count]) => (
                <Badge
                  key={scope}
                  variant="destructive"
                  className="text-xs"
                  aria-label={`${scope} scope: ${count} pieces dropped`}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  {scope}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Model Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Model: {meta.model || 'unknown'} | World: {meta.worldId ? `${meta.worldId.slice(0, 8)}...` : 'unknown'} | Ruleset: {meta.rulesetSlug || 'default'}
          {meta.scenarioSlug && ` | Scenario: ${meta.scenarioSlug}`}
        </div>
      </CardContent>
    </Card>
  );
}

