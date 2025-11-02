import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { TurnSummary } from '@/lib/debugStore';

interface TurnPickerProps {
  turns: TurnSummary[];
  selectedTurnKey: string | null;
  onSelectTurn: (turnKey: string) => void;
}

export function TurnPicker({ turns, selectedTurnKey, onSelectTurn }: TurnPickerProps) {
  if (turns.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        No debug data available
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent, turnIndex: number) => {
    if (e.key === 'ArrowUp' && turnIndex > 0) {
      e.preventDefault();
      onSelectTurn(turns[turnIndex - 1].turnKey);
    } else if (e.key === 'ArrowDown' && turnIndex < turns.length - 1) {
      e.preventDefault();
      onSelectTurn(turns[turnIndex + 1].turnKey);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSelectTurn(turns[0].turnKey);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSelectTurn(turns[turns.length - 1].turnKey);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2" role="listbox" aria-label="Turn selection">
        {turns.map((turn, index) => (
          <Button
            key={turn.turnKey}
            variant={selectedTurnKey === turn.turnKey ? 'secondary' : 'ghost'}
            className={cn(
              'w-full justify-start text-left h-auto py-2 px-3',
              selectedTurnKey === turn.turnKey && 'bg-secondary'
            )}
            onClick={() => onSelectTurn(turn.turnKey)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            role="option"
            aria-selected={selectedTurnKey === turn.turnKey}
            tabIndex={selectedTurnKey === turn.turnKey ? 0 : -1}
          >
            <div className="flex flex-col items-start gap-1">
              <div className="text-xs font-medium">
                #{turn.turnNumber} {turn.role}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {turn.summary}
              </div>
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}

