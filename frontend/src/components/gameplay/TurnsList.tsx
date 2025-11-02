/**
 * Phase 5: TurnsList - Display paginated turns with policy chips
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { getGameTurns } from '../../lib/api';
import { PromptMetaBar } from './PromptMetaBar';
import { SkeletonTurnsList } from './SkeletonTurnsList';
import { EmptyTurnsState } from './EmptyTurnsState';
import type { Turn, TurnMeta } from '../../lib/types';
import { Loader2, AlertTriangle, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface TurnsListProps {
  gameId: string;
  initialLimit?: number;
  className?: string;
  refreshKey?: number; // Phase 8: Trigger refetch when changed
  optimisticTurns?: Turn[]; // Phase 8: Temporary turns to show immediately
}

export function TurnsList({ gameId, initialLimit = 50, className, refreshKey = 0, optimisticTurns = [] }: TurnsListProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextAfterTurn, setNextAfterTurn] = useState<number | undefined>(undefined);

  const loadTurns = useCallback(
    async (afterTurn?: number, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await getGameTurns(gameId, {
          afterTurn,
          limit: initialLimit,
        });

        if (!result.ok) {
          setError(result.error.message);
          return;
        }

        // Phase 6.1: Handle normalized response shape (getGameTurns handles this, but defensive)
        const responseData = result.data as { turns?: any[]; next?: { afterTurn: number } };
        const newTurns = Array.isArray(responseData.turns) ? responseData.turns : [];
        const previousCount = append ? turns.length : 0;
        
        // Defensive: sort by turn_number ASC when merging pages
        const merged = append
          ? [...turns, ...newTurns].sort((a, b) => a.turn_number - b.turn_number)
          : newTurns.sort((a, b) => a.turn_number - b.turn_number);

        setTurns(merged);
        setNextAfterTurn(responseData.next?.afterTurn);

        // Phase 6.1: A11y announcement for loaded turns
        if (append && merged.length > previousCount) {
          const loadedCount = merged.length - previousCount;
          const announcement = document.getElementById('turns-loaded-announcement');
          if (announcement) {
            announcement.textContent = `Loaded ${loadedCount} more turn${loadedCount !== 1 ? 's' : ''}. Total: ${merged.length} turn${merged.length !== 1 ? 's' : ''}.`;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load turns');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [gameId, initialLimit, turns]
  );

  useEffect(() => {
    loadTurns();
  }, [gameId, refreshKey]); // Phase 8: Reload when refreshKey changes

  // Phase 8: Merge optimistic turns with loaded turns
  const displayTurns = [...turns, ...optimisticTurns].sort((a, b) => a.turn_number - b.turn_number);

  const handleLoadMore = () => {
    if (nextAfterTurn) {
      loadTurns(nextAfterTurn, true);
    }
  };

  const getPolicyBadges = (meta: TurnMeta | null | undefined) => {
    if (!meta?.policy || meta.policy.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {meta.policy.map((action) => {
          let variant: 'default' | 'destructive' | 'secondary' = 'secondary';
          let Icon = AlertTriangle;
          let label = action;

          if (action.includes('DROPPED')) {
            variant = 'destructive';
            Icon = XCircle;
          }

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
    );
  };

  if (loading) {
    return (
      <div className={className}>
        <SkeletonTurnsList count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className} role="alert">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <h4 className="font-semibold text-destructive mb-1">Failed to load turns</h4>
              <p className="text-sm text-muted-foreground mb-3">{error}</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => loadTurns()}
                aria-label="Retry loading turns"
              >
                <Loader2 className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (turns.length === 0) {
    return (
      <div className={className}>
        <EmptyTurnsState />
      </div>
    );
  }

  return (
    <div className={className} role="list" aria-label="Game turns">
      <div className="space-y-4">
        {displayTurns.map((turn) => {
          const isNarratorOrSystem = turn.role === 'narrator' || turn.role === 'system';
          const meta = turn.meta as TurnMeta | null | undefined;

          return (
            <Card key={turn.id} role="listitem">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Turn {turn.turn_number}</Badge>
                      <Badge variant="secondary" className="capitalize">
                        {turn.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(turn.created_at).toLocaleString()}
                      </span>
                    </div>

                    {turn.content && (
                      <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
                    )}

                    {/* Policy chips for narrator/system turns */}
                    {isNarratorOrSystem && getPolicyBadges(meta)}
                  </div>

                  {/* Show meta bar for first turn (narrator/system) */}
                  {turn.turn_number === 1 && isNarratorOrSystem && meta && (
                    <div className="hidden md:block min-w-[300px]">
                      <PromptMetaBar meta={meta} />
                    </div>
                  )}
                </div>

                {/* Mobile: Show meta bar below */}
                {turn.turn_number === 1 && isNarratorOrSystem && meta && (
                  <div className="mt-4 md:hidden">
                    <PromptMetaBar meta={meta} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Load More Button */}
      {nextAfterTurn && (
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleLoadMore}
            disabled={loadingMore}
            variant="outline"
            aria-label={`Load more turns. Currently showing ${turns.length} turns.`}
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Loading...
              </>
            ) : (
              `Load More (${turns.length} loaded)`
            )}
          </Button>
        </div>
      )}
      
      {/* Phase 5.1: Aria-live regions for accessibility */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
        id="turns-policy-updates"
      >
        {turns.length > 0 && turns[0]?.meta && (
          <span>
            {turns[0].meta.policy && turns[0].meta.policy.length > 0
              ? `Policy actions: ${turns[0].meta.policy.join(', ')}`
              : 'No policy actions'}
          </span>
        )}
      </div>
      
      {/* Phase 6.1: Announce loaded count when paginating */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="turns-loaded-announcement"
        data-testid="turns-loaded-announcement"
      />
    </div>
  );
}

