/**
 * Side-by-side prompt comparison view
 * Shows diff between two prompts with highlight for adds/removes
 */

import { useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { diffStrings } from '@/lib/diff';

interface ComparePromptViewProps {
  left: string;
  right: string;
  leftLabel: string;
  rightLabel: string;
}

export function ComparePromptView({ left, right, leftLabel, rightLabel }: ComparePromptViewProps) {
  const [showWhitespace, setShowWhitespace] = useState(false);
  
  // Memoize diff computation to avoid recalculation on every render
  const diff = useMemo(() => diffStrings(left, right, showWhitespace), [left, right, showWhitespace]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{diff.addedCount} added</span>
          <span>{diff.removedCount} removed</span>
          <span>{diff.equalCount} unchanged</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-whitespace"
            checked={showWhitespace}
            onCheckedChange={setShowWhitespace}
            aria-label="Show whitespace changes"
          />
          <Label htmlFor="show-whitespace" className="text-sm">
            Show whitespace
          </Label>
        </div>
      </div>

      {/* Side-by-side view */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{leftLabel}</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(left);
              }}
              aria-label="Copy left prompt"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="font-medium text-sm">{leftLabel}</div>
          <div className="border rounded-md overflow-hidden max-h-[600px] overflow-y-auto">
            {diff.lines.map((line, idx) => {
              if (line.type === 'add') return null; // Skip adds in left column
              
              const bgColor = line.type === 'remove' 
                ? 'bg-red-100 dark:bg-red-900/20' 
                : 'bg-transparent';
              
              return (
                <div key={idx} className={`px-2 py-1 text-xs font-mono ${bgColor}`}>
                  {line.type === 'remove' && <span className="text-red-600">- </span>}
                  {line.content}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{rightLabel}</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(right);
              }}
              aria-label="Copy right prompt"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="border rounded-md overflow-hidden max-h-[600px] overflow-y-auto">
            {diff.lines.map((line, idx) => {
              if (line.type === 'remove') return null; // Skip removes in right column
              
              const bgColor = line.type === 'add' 
                ? 'bg-green-100 dark:bg-green-900/20' 
                : 'bg-transparent';
              
              return (
                <div key={idx} className={`px-2 py-1 text-xs font-mono ${bgColor}`}>
                  {line.type === 'add' && <span className="text-green-600">+ </span>}
                  {line.content}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

