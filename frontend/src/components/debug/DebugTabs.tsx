import { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Copy } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { ComparePromptView } from './ComparePromptView';
import { CompareView } from './CompareView';
import { redactSensitiveClient } from '@/lib/debug';
import type { DebugPayload } from '@/lib/debugStore';

interface DebugTabsProps {
  debug: DebugPayload;
  compareMode?: boolean;
  compareDebug?: DebugPayload;
}

export function DebugTabs({ debug, compareMode = false, compareDebug }: DebugTabsProps) {
  const [activeTab, setActiveTab] = useState('prompt');
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabs = ['prompt', 'ai', 'pieces', 'meta', 'timings'];
  const tabIndex = tabs.indexOf(activeTab);

  // Redact sensitive data before rendering
  const safeDebug = redactSensitiveClient(debug);
  const safeCompareDebug = compareDebug ? redactSensitiveClient(compareDebug) : null;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!tabListRef.current) return;

      if (e.key === 'ArrowLeft' && tabIndex > 0) {
        e.preventDefault();
        setActiveTab(tabs[tabIndex - 1]);
        const prevTab = tabListRef.current.querySelector(`[data-value="${tabs[tabIndex - 1]}"]`) as HTMLElement;
        prevTab?.focus();
      } else if (e.key === 'ArrowRight' && tabIndex < tabs.length - 1) {
        e.preventDefault();
        setActiveTab(tabs[tabIndex + 1]);
        const nextTab = tabListRef.current.querySelector(`[data-value="${tabs[tabIndex + 1]}"]`) as HTMLElement;
        nextTab?.focus();
      }
    };

    if (compareMode) {
      // In compare mode, focus is on compare view
      return;
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, tabIndex, compareMode, tabs]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
  };

  // Group pieces by scope
  const piecesByScope: Record<string, typeof safeDebug.assembler.pieces> = {};
  safeDebug.assembler.pieces.forEach(piece => {
    const scope = piece.scope.toLowerCase();
    if (!piecesByScope[scope]) {
      piecesByScope[scope] = [];
    }
    piecesByScope[scope].push(piece);
  });

  const scopeOrder = ['core', 'ruleset', 'world', 'scenario', 'entry', 'entry_start', 'npc'];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList 
        ref={tabListRef}
        className={`grid w-full ${compareMode && compareDebug ? 'grid-cols-6' : 'grid-cols-5'}`}
        role="tablist"
      >
        <TabsTrigger value="prompt" role="tab" aria-label="Prompt tab">Prompt</TabsTrigger>
        {compareMode && compareDebug && (
          <TabsTrigger value="compare" role="tab" aria-label="Compare tab">Compare</TabsTrigger>
        )}
        <TabsTrigger value="ai" role="tab" aria-label="AI I/O tab">AI I/O</TabsTrigger>
        <TabsTrigger value="pieces" role="tab" aria-label="Pieces tab">Pieces</TabsTrigger>
        <TabsTrigger value="meta" role="tab" aria-label="Meta tab">Meta</TabsTrigger>
        <TabsTrigger value="timings" role="tab" aria-label="Timings tab">Timings</TabsTrigger>
      </TabsList>

      <TabsContent value="prompt" className="mt-4">
        {compareMode && safeCompareDebug ? (
          <ComparePromptView 
            left={safeDebug.assembler.prompt} 
            right={safeCompareDebug.assembler.prompt}
            leftLabel={`Turn ${safeDebug.debugId.split(':')[1]}`}
            rightLabel={`Turn ${safeCompareDebug.debugId.split(':')[1]}`}
          />
        ) : (
          <CodeBlock 
            content={safeDebug.assembler.prompt} 
            language="text"
            aria-label="Assembled prompt"
          />
        )}
      </TabsContent>
      
      {compareMode && safeCompareDebug && (
        <TabsContent value="compare" className="mt-4">
          <CompareView left={safeDebug} right={safeCompareDebug} />
        </TabsContent>
      )}

      <TabsContent value="ai" className="mt-4">
        <div className="space-y-4">
          {safeDebug.ai?.request && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Request</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(safeDebug.ai?.request, null, 2), 'AI request')}
                  className="h-7 text-xs"
                  aria-label="Copy AI request"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <CodeBlock 
                content={JSON.stringify(safeDebug.ai.request, null, 2)} 
                language="json"
                maxDisplayChars={10000}
              />
            </div>
          )}

          {safeDebug.ai?.rawResponse && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Raw Response</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(safeDebug.ai?.rawResponse, null, 2), 'AI raw response')}
                  className="h-7 text-xs"
                  aria-label="Copy AI raw response"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <CodeBlock 
                content={JSON.stringify(safeDebug.ai.rawResponse, null, 2)} 
                language="json"
                maxDisplayChars={10000}
              />
            </div>
          )}

          {safeDebug.ai?.transformed && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Transformed</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(safeDebug.ai?.transformed, null, 2), 'AI transformed response')}
                  className="h-7 text-xs"
                  aria-label="Copy AI transformed response"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <CodeBlock 
                content={JSON.stringify(safeDebug.ai.transformed, null, 2)} 
                language="json"
                maxDisplayChars={10000}
              />
            </div>
          )}

          {!safeDebug.ai && (
            <div className="text-sm text-muted-foreground p-4 text-center">
              No AI data available (safe mode or not captured)
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="pieces" className="mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Scope</TableHead>
                <TableHead className="text-xs">Slug</TableHead>
                <TableHead className="text-xs">Version</TableHead>
                <TableHead className="text-xs">Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopeOrder.map(scope => {
                const pieces = piecesByScope[scope] || [];
                return pieces.map((piece, idx) => (
                  <TableRow key={`${piece.scope}-${piece.slug}-${idx}`}>
                    <TableCell className="text-xs font-mono">{piece.scope}</TableCell>
                    <TableCell className="text-xs">{piece.slug}</TableCell>
                    <TableCell className="text-xs">{piece.version || '-'}</TableCell>
                    <TableCell className="text-xs">{piece.tokens || '-'}</TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="meta" className="mt-4">
        <div className="space-y-4">
          {/* Policy Badges */}
          {safeDebug.assembler.meta.policy && safeDebug.assembler.meta.policy.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Policy</div>
              <div className="flex flex-wrap gap-1">
                {safeDebug.assembler.meta.policy.map((p: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Token Estimate */}
          {safeDebug.assembler.meta.tokenEst && (
            <div>
              <div className="text-sm font-medium mb-1">
                Token Usage: {safeDebug.assembler.meta.tokenEst.input} / {safeDebug.assembler.meta.tokenEst.budget} ({Math.round(safeDebug.assembler.meta.tokenEst.pct * 100)}%)
              </div>
              <Progress 
                value={Math.min(safeDebug.assembler.meta.tokenEst.pct * 100, 100)} 
                className="h-2"
              />
            </div>
          )}

          {/* Included/Dropped */}
          {safeDebug.assembler.meta.included && safeDebug.assembler.meta.included.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1">Included ({safeDebug.assembler.meta.included.length})</div>
              <div className="text-xs text-muted-foreground">
                {safeDebug.assembler.meta.included.join(', ')}
              </div>
            </div>
          )}

          {safeDebug.assembler.meta.dropped && safeDebug.assembler.meta.dropped.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1">Dropped ({safeDebug.assembler.meta.dropped.length})</div>
              <div className="text-xs text-muted-foreground">
                {safeDebug.assembler.meta.dropped.join(', ')}
              </div>
            </div>
          )}

          {/* Model/World/Ruleset/Scenario/Entry */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {safeDebug.assembler.meta.model && (
              <div>
                <span className="font-medium">Model:</span> {safeDebug.assembler.meta.model}
              </div>
            )}
            {safeDebug.assembler.meta.worldId && (
              <div>
                <span className="font-medium">World:</span> {safeDebug.assembler.meta.worldId}
              </div>
            )}
            {safeDebug.assembler.meta.rulesetSlug && (
              <div>
                <span className="font-medium">Ruleset:</span> {safeDebug.assembler.meta.rulesetSlug}
              </div>
            )}
            {safeDebug.assembler.meta.scenarioSlug && (
              <div>
                <span className="font-medium">Scenario:</span> {safeDebug.assembler.meta.scenarioSlug}
              </div>
            )}
            {safeDebug.assembler.meta.entryStartSlug && (
              <div>
                <span className="font-medium">Entry:</span> {safeDebug.assembler.meta.entryStartSlug}
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="timings" className="mt-4">
        {safeDebug.timings ? (
          <div className="space-y-4">
            <div className="text-sm font-medium mb-2">Timing Breakdown</div>
            {safeDebug.timings.assembleMs !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs">Assembly</span>
                  <span className="text-xs font-mono">{safeDebug.timings.assembleMs}ms</span>
                </div>
                {safeDebug.timings.totalMs && (
                  <div className="text-xs text-muted-foreground">
                    {Math.round((safeDebug.timings.assembleMs / safeDebug.timings.totalMs) * 100)}% of total
                  </div>
                )}
              </div>
            )}
            {safeDebug.timings.aiMs !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs">AI Generation</span>
                  <span className="text-xs font-mono">{safeDebug.timings.aiMs}ms</span>
                </div>
                {safeDebug.timings.totalMs && (
                  <div className="text-xs text-muted-foreground">
                    {Math.round((safeDebug.timings.aiMs / safeDebug.timings.totalMs) * 100)}% of total
                  </div>
                )}
              </div>
            )}
            {safeDebug.timings.totalMs !== undefined && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-sm font-mono font-medium">{safeDebug.timings.totalMs}ms</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground p-4 text-center">
            No timing data available
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
