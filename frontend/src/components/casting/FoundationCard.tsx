/**
 * FoundationCard Component
 * Phase 3-B: Hub & Spoke visual hierarchy
 * Displays a foundation ruleset as a selectable card with radio button behavior
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

interface FoundationCardProps {
  ruleset: RulesetDefinition;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function FoundationCard({ ruleset, isSelected, onSelect }: FoundationCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected
          ? 'ring-2 ring-primary ring-offset-2 border-primary'
          : 'hover:border-primary/50'
      )}
      onClick={() => onSelect(ruleset.id)}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(ruleset.id);
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {isSelected ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              {ruleset.name}
            </CardTitle>
            {ruleset.description_short && (
              <CardDescription className="mt-2">
                {ruleset.description_short}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      {ruleset.description_long && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">{ruleset.description_long}</p>
        </CardContent>
      )}
    </Card>
  );
}

