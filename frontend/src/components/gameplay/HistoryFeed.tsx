import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Clock, User, Bot } from 'lucide-react';

interface HistoryEntry {
  id: string;
  timestamp: string;
  type: 'player' | 'npc' | 'system';
  content: string;
  character?: string;
}

interface HistoryFeedProps {
  history: HistoryEntry[];
  className?: string;
}

export const HistoryFeed: React.FC<HistoryFeedProps> = ({
  history,
  className
}) => {
  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'player':
        return <User className="h-4 w-4" />;
      case 'npc':
        return <Bot className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEntryColor = (type: string) => {
    switch (type) {
      case 'player':
        return 'border-l-primary bg-primary/5';
      case 'npc':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-l-muted bg-muted/20';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Game History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {history.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No history yet. Start playing to see your adventure unfold!
          </p>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className={`p-3 rounded-lg border-l-4 ${getEntryColor(entry.type)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getEntryIcon(entry.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {entry.type}
                    </Badge>
                    {entry.character && (
                      <span className="text-sm font-medium text-muted-foreground">
                        {entry.character}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm">{entry.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
