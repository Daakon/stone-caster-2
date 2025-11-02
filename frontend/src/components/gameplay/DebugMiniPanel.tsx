import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { redactSensitiveClient } from '@/lib/debug';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DebugMiniPanelProps {
  debug?: {
    phase: 'start' | 'turn';
    assembler: {
      prompt: string;
      pieces: Array<{ scope: string; slug: string; version?: string; tokens?: number }>;
      meta: {
        included?: string[];
        dropped?: string[];
        policy?: string[];
        model?: string;
        worldId?: string;
        rulesetSlug?: string;
        scenarioSlug?: string | null;
        entryStartSlug?: string;
        tokenEst?: { input: number; budget: number; pct: number };
        [key: string]: any;
      };
    };
    ai?: {
      request?: any;
      rawResponse?: any;
      transformed?: any;
    };
    timings?: {
      assembleMs?: number;
      aiMs?: number;
      totalMs?: number;
    };
  };
}

export function DebugMiniPanel({ debug }: DebugMiniPanelProps) {
  if (!debug) return null;

  // Redact sensitive data client-side (belt-and-suspenders)
  const safeDebug = redactSensitiveClient(debug);
  const [expandedPrompt, setExpandedPrompt] = useState(false);

  const prompt = safeDebug.assembler.prompt || '';
  const promptPreview = prompt.substring(0, 600);
  const showPromptExpand = prompt.length > 600;

  const copyToClipboard = (text: string) => {
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
    <Card className="mt-4 border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Debug Panel
            <Badge variant="secondary" className="text-xs">
              {safeDebug.phase === 'start' ? 'Start' : 'Turn'}
            </Badge>
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
              Active
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion type="multiple" defaultValue={[]} className="w-full">
          {/* Prompt Section */}
          <AccordionItem value="prompt">
            <AccordionTrigger className="text-sm">Prompt</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(prompt)}
                    className="h-7 text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="relative">
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-96 overflow-y-auto">
                    {expandedPrompt ? prompt : promptPreview}
                  </pre>
                  {showPromptExpand && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPrompt(!expandedPrompt)}
                      className="absolute bottom-2 right-2 h-6 text-xs"
                    >
                      {expandedPrompt ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Expand ({prompt.length} chars)
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pieces Section */}
          <AccordionItem value="pieces">
            <AccordionTrigger className="text-sm">
              Pieces ({safeDebug.assembler.pieces.length})
            </AccordionTrigger>
            <AccordionContent>
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
            </AccordionContent>
          </AccordionItem>

          {/* Meta Section */}
          <AccordionItem value="meta">
            <AccordionTrigger className="text-sm">Meta</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {/* Policy Badges */}
                {safeDebug.assembler.meta.policy && safeDebug.assembler.meta.policy.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-2">Policy</div>
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
                    <div className="text-xs font-medium mb-1">
                      Token Usage: {safeDebug.assembler.meta.tokenEst.input} / {safeDebug.assembler.meta.tokenEst.budget} ({Math.round(safeDebug.assembler.meta.tokenEst.pct * 100)}%)
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(safeDebug.assembler.meta.tokenEst.pct * 100, 100)}%` }}
                      />
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

                {/* Timings */}
                {safeDebug.timings && (
                  <div className="text-xs">
                    <div className="font-medium mb-1">Timings</div>
                    <div className="space-y-1">
                      {safeDebug.timings.assembleMs !== undefined && (
                        <div>Assemble: {safeDebug.timings.assembleMs}ms</div>
                      )}
                      {safeDebug.timings.aiMs !== undefined && (
                        <div>AI: {safeDebug.timings.aiMs}ms</div>
                      )}
                      {safeDebug.timings.totalMs !== undefined && (
                        <div>Total: {safeDebug.timings.totalMs}ms</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

