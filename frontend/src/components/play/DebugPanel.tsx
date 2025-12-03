/**
 * Debug Panel Component
 * Displays debug information from the play loop
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Code, Info } from 'lucide-react';
import type { CastStoneResponse } from '@/services/chimera.play';

interface DebugPanelProps {
  debugInfo: CastStoneResponse['debug_info'];
  className?: string;
}

export function DebugPanel({ debugInfo, className }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['mas_1_output']));

  if (!debugInfo) {
    return null;
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Code className="h-4 w-4" />
                Debug Panel
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* MAS 1 Output */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => toggleSection('mas_1_output')}
              >
                <span className="text-xs font-medium">MAS 1: Intent & Sentiment</span>
                {expandedSections.has('mas_1_output') ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
              {expandedSections.has('mas_1_output') && (
                <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold">Input:</span>{' '}
                      <span className="text-muted-foreground">{debugInfo.mas_1_input}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Action:</span>{' '}
                      <code>{debugInfo.mas_1_output.actionDto.action}</code>
                      {debugInfo.mas_1_output.actionDto.target && (
                        <>
                          {' → '}
                          <code>{debugInfo.mas_1_output.actionDto.target}</code>
                        </>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Resolved Query:</span>{' '}
                      <span className="text-muted-foreground">
                        {debugInfo.mas_1_output.resolvedQuery}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Sentiment:</span>{' '}
                      <code>
                        {debugInfo.mas_1_output.detectedSentiment.tone} (
                        {debugInfo.mas_1_output.detectedSentiment.intensity}/10)
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Engine Outcome */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => toggleSection('engine_outcome')}
              >
                <span className="text-xs font-medium">Engine: Outcome</span>
                {expandedSections.has('engine_outcome') ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
              {expandedSections.has('engine_outcome') && (
                <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  <pre>{JSON.stringify(debugInfo.engine_outcome, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* MAS 2 Response */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => toggleSection('mas_2_response')}
              >
                <span className="text-xs font-medium">MAS 2: Narrative & Requests</span>
                {expandedSections.has('mas_2_response') ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
              {expandedSections.has('mas_2_response') && (
                <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold">Mutations:</span>{' '}
                      <code>{debugInfo.mas_2_response.mutations.length}</code>
                    </div>
                    {debugInfo.mas_2_response.engine_requests && (
                      <div>
                        <span className="font-semibold">Engine Requests:</span>{' '}
                        <code>{debugInfo.mas_2_response.engine_requests.length}</code>
                      </div>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold">
                        View Full Response
                      </summary>
                      <pre className="mt-2 text-[10px]">
                        {JSON.stringify(debugInfo.mas_2_response, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}
            </div>

            {/* Final Mutations */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => toggleSection('final_mutations')}
              >
                <span className="text-xs font-medium">Final Mutations</span>
                {expandedSections.has('final_mutations') ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
              {expandedSections.has('final_mutations') && (
                <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  <div className="space-y-1">
                    {debugInfo.final_mutations.length === 0 ? (
                      <span className="text-muted-foreground">No mutations</span>
                    ) : (
                      debugInfo.final_mutations.map((mutation, idx) => (
                        <div key={idx} className="flex gap-2">
                          <code className="text-[10px]">
                            {mutation.op} {mutation.path}
                          </code>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

