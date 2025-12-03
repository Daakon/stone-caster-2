// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Game Log Component (Narrative Feed)
 * Phase 7: Game Play Interface (Frontend)
 * Scrollable list of events with distinct visual separation between Player and Narrator
 */

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Bot } from 'lucide-react';

export interface LogEntry {
  id: string;
  role: 'player' | 'narrator';
  text: string;
  timestamp: Date;
}

interface GameLogProps {
  entries: LogEntry[];
}

export function GameLog({ entries }: GameLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Your adventure begins here...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="space-y-4 p-4">
        {entries.map((entry) => (
          <Card
            key={entry.id}
            className={
              entry.role === 'player'
                ? 'bg-primary/10 border-primary/20 ml-8'
                : 'bg-muted/50 mr-8'
            }
          >
            <CardContent className="pt-4">
              <div className="flex items-start gap-2 mb-2">
                {entry.role === 'player' ? (
                  <User className="h-4 w-4 text-primary mt-0.5" />
                ) : (
                  <Bot className="h-4 w-4 text-muted-foreground mt-0.5" />
                )}
                <Badge
                  variant={entry.role === 'player' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {entry.role === 'player' ? 'You' : 'Narrator'}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {entry.text}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {entry.timestamp.toLocaleTimeString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// Keep NarrativeFeed for backward compatibility
export interface NarrativeEntry {
  id: string;
  narrative: string;
  outcome_summary?: string;
  timestamp: Date;
}

interface NarrativeFeedProps {
  history: NarrativeEntry[];
}

export function NarrativeFeed({ history }: NarrativeFeedProps) {
  // Convert NarrativeEntry[] to LogEntry[]
  const logEntries: LogEntry[] = history.map((entry) => ({
    id: entry.id,
    role: 'narrator',
    text: entry.narrative,
    timestamp: entry.timestamp,
  }));

  return <GameLog entries={logEntries} />;
}

