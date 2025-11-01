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

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {turns.map((turn) => (
          <Button
            key={turn.turnKey}
            variant={selectedTurnKey === turn.turnKey ? 'secondary' : 'ghost'}
            className={cn(
              'w-full justify-start text-left h-auto py-2 px-3',
              selectedTurnKey === turn.turnKey && 'bg-secondary'
            )}
            onClick={() => onSelectTurn(turn.turnKey)}
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

