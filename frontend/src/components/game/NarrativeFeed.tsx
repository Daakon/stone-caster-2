// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Narrative Feed Component
 * Displays the story history with scroll-to-bottom on update
 */

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when history updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Your adventure begins here...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="space-y-4 p-4">
        {history.map((entry) => (
          <Card key={entry.id} className="bg-muted/50">
            <CardContent className="pt-4">
              {entry.outcome_summary && (
                <div className="mb-2">
                  <Badge variant="outline" className="text-xs">
                    {entry.outcome_summary}
                  </Badge>
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {entry.narrative}
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

