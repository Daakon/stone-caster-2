// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Stats Panel Component
 * Dynamically renders Tier 1 mechanical state (HP, Mana, Stats, Inventory, etc.)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StatsPanelProps {
  tier1Data: Record<string, unknown>;
}

export function StatsPanel({ tier1Data }: StatsPanelProps) {
  const renderValue = (key: string, value: unknown): React.ReactNode => {
    // Handle numbers
    if (typeof value === 'number') {
      // Check if there's a corresponding max value (e.g., hp and max_hp)
      const maxKey = `max_${key}`;
      const maxValue = tier1Data[maxKey];
      
      if (typeof maxValue === 'number' && maxValue > 0) {
        // Render as progress bar
        const percentage = Math.min((value / maxValue) * 100, 100);
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="text-muted-foreground">
                {value} / {maxValue}
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        );
      } else {
        // Render as badge
        return (
          <div key={key} className="flex justify-between items-center">
            <span className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</span>
            <Badge variant="secondary">{value}</Badge>
          </div>
        );
      }
    }

    // Handle arrays (e.g., inventory)
    if (Array.isArray(value)) {
      return (
        <div key={key} className="space-y-2">
          <h4 className="text-sm font-semibold capitalize">{key.replace(/_/g, ' ')}</h4>
          {value.length > 0 ? (
            <ul className="space-y-1">
              {value.map((item, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  • {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Empty</p>
          )}
        </div>
      );
    }

    // Handle objects (nested stats)
    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} className="space-y-2">
          <h4 className="text-sm font-semibold capitalize">{key.replace(/_/g, ' ')}</h4>
          <div className="pl-4 space-y-2 border-l">
            {Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) =>
              renderValue(nestedKey, nestedValue)
            )}
          </div>
        </div>
      );
    }

    // Handle strings and other types
    return (
      <div key={key} className="flex justify-between items-center">
        <span className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</span>
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      </div>
    );
  };

  const entries = Object.entries(tier1Data);

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Character Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No stats available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Character Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-4">
            {entries.map(([key, value]) => renderValue(key, value))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

