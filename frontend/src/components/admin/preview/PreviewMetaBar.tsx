/**
 * Preview Meta Bar
 * Token gauge, npcBefore/After, budget info
 */

import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface PreviewMetaBarProps {
  tokenEst: {
    input: number;
    budget: number;
    pct: number;
  };
  npcBefore: number;
  npcAfter: number;
  byScope?: Record<string, number>;
}

export function PreviewMetaBar({
  tokenEst,
  npcBefore,
  npcAfter,
  byScope,
}: PreviewMetaBarProps) {
  const tokenPct = Math.round(tokenEst.pct * 100);
  const isOverBudget = tokenEst.input > tokenEst.budget;
  const npcTrimmed = npcBefore - npcAfter;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
      {/* Token Gauge */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{tokenEst.input.toLocaleString()} / {tokenEst.budget.toLocaleString()}</span>
              <span className={isOverBudget ? 'text-destructive' : ''}>{tokenPct}%</span>
            </div>
            <Progress
              value={Math.min(tokenPct, 100)}
              className={isOverBudget ? 'bg-destructive' : ''}
              aria-label={`Token usage: ${tokenPct}%`}
            />
            {isOverBudget && (
              <Badge variant="destructive" className="mt-2">
                Over Budget
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* NPC Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">NPCs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-sm">
              <span className="text-muted-foreground">Before:</span>{' '}
              <span className="font-medium">{npcBefore}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">After:</span>{' '}
              <span className="font-medium">{npcAfter}</span>
            </div>
            {npcTrimmed > 0 && (
              <Badge variant="outline" className="mt-2">
                {npcTrimmed} trimmed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pre-NPC Token % Badge */}
      {byScope && (
        <div className="absolute top-2 right-2">
          {(() => {
            const preNpcTokens = Object.entries(byScope)
              .filter(([scope]) => scope !== 'npc')
              .reduce((sum, [, tokens]) => sum + tokens, 0);
            const totalTokens = Object.values(byScope).reduce((sum, tokens) => sum + tokens, 0);
            const preNpcPct = totalTokens > 0 ? preNpcTokens / totalTokens : 0;
            const pctRounded = Math.round(preNpcPct * 100);
            
            return (
              <Badge 
                variant={pctRounded > 75 ? 'destructive' : pctRounded > 60 ? 'default' : 'outline'}
                className="text-xs"
              >
                Pre-NPC: {pctRounded}%
              </Badge>
            );
          })()}
        </div>
      )}

      {/* By Scope Breakdown */}
      {byScope && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Scope</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {Object.entries(byScope)
                .sort(([, a], [, b]) => b - a)
                .map(([scope, tokens]) => (
                  <div key={scope} className="flex justify-between">
                    <span className="text-muted-foreground">{scope}:</span>
                    <span className="font-medium">{tokens.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

