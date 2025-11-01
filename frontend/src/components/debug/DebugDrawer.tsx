import { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, X, GitCompare } from 'lucide-react';
import { debugStore, type DebugPayload } from '@/lib/debugStore';
import { DebugTabs } from './DebugTabs';
import { TurnPicker } from './TurnPicker';

interface DebugDrawerProps {
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebugDrawer({ gameId, open, onOpenChange }: DebugDrawerProps) {
  const [selectedTurnKey, setSelectedTurnKey] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareTurnKey, setCompareTurnKey] = useState<string | null>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  const turns = debugStore.getAll(gameId);
  const selectedDebug = selectedTurnKey ? debugStore.getDebug(selectedTurnKey) : null;
  const compareDebug = compareTurnKey ? debugStore.getDebug(compareTurnKey) : null;

  // Auto-select first turn when drawer opens and turns are available
  useEffect(() => {
    if (open && turns.length > 0 && !selectedTurnKey) {
      setSelectedTurnKey(turns[0].turnKey);
    }
  }, [open, turns, selectedTurnKey]);

  // Announce drawer state changes
  useEffect(() => {
    if (announcementRef.current) {
      if (open) {
        announcementRef.current.textContent = 'Debug drawer opened';
      } else {
        announcementRef.current.textContent = 'Debug drawer closed';
      }
    }
  }, [open]);

  const handleExport = () => {
    if (!selectedDebug) return;

    const fileName = `debug-${gameId}-t${selectedDebug.debugId.split(':')[1]}.json`;
    const blob = new Blob([JSON.stringify(selectedDebug, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCompare = () => {
    if (compareMode) {
      // Exit compare mode
      setCompareMode(false);
      setCompareTurnKey(null);
    } else {
      // Enter compare mode - use first available turn as compare target
      const otherTurns = turns.filter(t => t.turnKey !== selectedTurnKey);
      if (otherTurns.length > 0) {
        setCompareTurnKey(otherTurns[0].turnKey);
        setCompareMode(true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !compareMode) {
      onOpenChange(false);
    } else if (e.key === 'Escape' && compareMode) {
      setCompareMode(false);
      setCompareTurnKey(null);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Announcement region for screen readers */}
      <div
        ref={announcementRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className="w-[420px] sm:w-[420px] p-0 flex flex-col"
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="debug-drawer-title"
        >
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle id="debug-drawer-title" className="flex items-center gap-2">
                Debug Panel
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                  Active
                </Badge>
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0"
                aria-label="Close debug drawer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Turn Picker Sidebar */}
            <div className="border-b px-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Per-turn</span>
                {selectedDebug && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExport}
                      className="h-7 text-xs"
                      aria-label="Export debug payload as JSON"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                    {turns.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCompare}
                        className={compareMode ? 'bg-secondary' : ''}
                        aria-label={compareMode ? 'Exit compare mode' : 'Compare turns'}
                      >
                        <GitCompare className="h-3 w-3 mr-1" />
                        Compare
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="h-[120px]">
                <TurnPicker
                  turns={turns}
                  selectedTurnKey={selectedTurnKey}
                  onSelectTurn={(turnKey) => {
                    setSelectedTurnKey(turnKey);
                    if (compareMode && turnKey === compareTurnKey) {
                      // If selecting the compare turn, switch roles
                      setCompareTurnKey(selectedTurnKey);
                      setSelectedTurnKey(turnKey);
                    }
                  }}
                />
              </div>
            </div>

            {/* Debug Content Area */}
            <div className="flex-1 overflow-hidden p-4">
              {selectedDebug ? (
                <DebugTabs
                  debug={selectedDebug}
                  compareMode={compareMode}
                  compareDebug={compareDebug || undefined}
                />
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Select a turn to view debug data
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

