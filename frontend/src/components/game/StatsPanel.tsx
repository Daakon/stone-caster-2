// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Stats Panel Component
 * Phase 7: Game Play Interface (Frontend)
 * Visualizes gameState.tier1_mechanical.entities.player
 * - HP/MP as progress bars (if keys exist)
 * - Attributes (Str, Dex, etc.) as a grid
 * - Handles missing keys gracefully
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StatsPanelProps {
  tier1Data: Record<string, unknown>;
}

export function StatsPanel({ tier1Data }: StatsPanelProps) {
  // Extract player entity from tier1_mechanical.entities.player
  const entities = tier1Data?.entities as Record<string, unknown> | undefined;
  const player = entities?.player as Record<string, unknown> | undefined;
  const playerStats = player?.stats as Record<string, unknown> | undefined;

  // Use player data if available, otherwise fall back to top-level data
  const displayData = playerStats || player || tier1Data || {};
  const renderValue = (key: string, value: unknown, parentData?: Record<string, unknown>): React.ReactNode => {
    // Handle numbers
    if (typeof value === 'number') {
      // Check for HP/MP pattern - look for max_hp, max_mp, or hp_max, mp_max
      const maxKey = `max_${key}`;
      const altMaxKey = `${key}_max`;
      const maxValue = parentData?.[maxKey] || parentData?.[altMaxKey];

      // HP and MP should be progress bars if max exists
      if ((key === 'hp' || key === 'mp' || key === 'mana') && typeof maxValue === 'number' && maxValue > 0) {
        const percentage = Math.min((value / maxValue) * 100, 100);
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium uppercase">{key}</span>
              <span className="text-muted-foreground">
                {value} / {maxValue}
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        );
      } else {
        // Attributes (Str, Dex, etc.) as badges in a grid
        return (
          <div key={key} className="flex flex-col items-center p-2 border rounded">
            <span className="text-xs text-muted-foreground uppercase mb-1">{key}</span>
            <Badge variant="secondary" className="text-lg">{value}</Badge>
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

  const entries = Object.entries(displayData);

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

  // Separate HP/MP from attributes
  const resourceEntries = entries.filter(([key]) =>
    key === 'hp' || key === 'mp' || key === 'mana'
  );
  const attributeEntries = entries.filter(([key]) =>
    key !== 'hp' && key !== 'mp' && key !== 'mana' && typeof displayData[key] === 'number'
  );
  const otherEntries = entries.filter(([key]) =>
    key !== 'hp' && key !== 'mp' && key !== 'mana' && typeof displayData[key] !== 'number'
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Character Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-4">
            {/* Resources (HP/MP) */}
            {resourceEntries.length > 0 && (
              <div className="space-y-3">
                {resourceEntries.map(([key, value]) => renderValue(key, value, displayData))}
              </div>
            )}

            {/* Attributes Grid */}
            {attributeEntries.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Attributes</h4>
                <div className="grid grid-cols-3 gap-2">
                  {attributeEntries.map(([key, value]) => renderValue(key, value, displayData))}
                </div>
              </div>
            )}

            {/* Other entries */}
            {otherEntries.map(([key, value]) => renderValue(key, value, displayData))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

