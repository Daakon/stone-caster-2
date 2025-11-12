/**
 * Context Chips Component
 * Displays compact chips for current context IDs and templates version
 */

import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { PromptAuthoringContext } from './PromptAuthoringSection';

interface ContextChipsProps {
  context: PromptAuthoringContext;
  worldName?: string;
  rulesetName?: string;
  scenarioName?: string;
  npcNames?: Record<string, string>;
  onRemove?: (type: 'world' | 'ruleset' | 'scenario' | 'npc', id: string) => void;
  showTemplatesLink?: boolean;
}

export function ContextChips({
  context,
  worldName,
  rulesetName,
  scenarioName,
  npcNames = {},
  onRemove,
  showTemplatesLink = true,
}: ContextChipsProps) {
  const hasAnyContext = !!(context.worldId || context.rulesetId || context.scenarioId || (context.npcIds && context.npcIds.length > 0));

  if (!hasAnyContext && !context.templatesVersion) {
    return null;
  }

  // Build templates link with resolved slots
  // Use absolute path to /admin/templates
  const templatesLink = showTemplatesLink && (context.worldId || context.rulesetId || context.scenarioId || context.npcIds) 
    ? `/admin/templates?type=${context.worldId ? 'world' : context.rulesetId ? 'ruleset' : context.scenarioId ? 'scenario' : 'npc'}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {context.worldId && (
        <Badge variant="outline" className="gap-1">
          World: {worldName || context.worldId.substring(0, 8)}...
          {onRemove && (
            <button
              onClick={() => onRemove('world', context.worldId!)}
              className="ml-1 hover:text-destructive"
              aria-label="Remove world"
            >
              ×
            </button>
          )}
        </Badge>
      )}
      {context.rulesetId && (
        <Badge variant="outline" className="gap-1">
          Ruleset: {rulesetName || context.rulesetId.substring(0, 8)}...
          {onRemove && (
            <button
              onClick={() => onRemove('ruleset', context.rulesetId!)}
              className="ml-1 hover:text-destructive"
              aria-label="Remove ruleset"
            >
              ×
            </button>
          )}
        </Badge>
      )}
      {context.scenarioId && (
        <Badge variant="outline" className="gap-1">
          Scenario: {scenarioName || context.scenarioId.substring(0, 8)}...
          {onRemove && (
            <button
              onClick={() => onRemove('scenario', context.scenarioId!)}
              className="ml-1 hover:text-destructive"
              aria-label="Remove scenario"
            >
              ×
            </button>
          )}
        </Badge>
      )}
      {context.npcIds && context.npcIds.length > 0 && (
        <Badge variant="outline">
          NPCs: {context.npcIds.length}
        </Badge>
      )}
      {context.templatesVersion ? (
        <Badge variant="outline">
          Templates: v{context.templatesVersion}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          Templates: Latest
        </Badge>
      )}
      {templatesLink && (
        <Link to={templatesLink} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          View templates
        </Link>
      )}
    </div>
  );
}

