/**
 * Debug Panel Component
 * Shows prompt assembly details with clear indicators for system-generated vs authored content
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Info, Code, Database, Zap } from 'lucide-react';

interface PromptBlock {
  kind: string;
  content: string;
  segmentIds?: number[];
  tokens?: number;
}

interface DebugPanelProps {
  blocks: PromptBlock[];
  totalTokens?: number;
  assemblyOrder?: string[];
  segmentIdsByScope?: Record<string, number[]>;
}

export function BlockBadge({ kind }: { kind: string }) {
  const systemGenerated = ['game_state', 'player', 'rng', 'input'].includes(kind);
  
  return (
    <Badge 
      variant={systemGenerated ? 'secondary' : 'default'}
      className={`text-xs px-2 py-0.5 ${
        systemGenerated 
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
          : 'bg-green-500/10 text-green-400 border-green-500/20'
      }`}
    >
      {systemGenerated ? (
        <>
          <Zap className="w-3 h-3 mr-1" />
          System-Generated
        </>
      ) : (
        <>
          <Database className="w-3 h-3 mr-1" />
          Authored
        </>
      )}
    </Badge>
  );
}

export function DebugPanel({ 
  blocks, 
  totalTokens, 
  assemblyOrder = [],
  segmentIdsByScope = {}
}: DebugPanelProps) {
  const systemGeneratedBlocks = blocks.filter(block => 
    ['game_state', 'player', 'rng', 'input'].includes(block.kind)
  );
  
  const authoredBlocks = blocks.filter(block => 
    !['game_state', 'player', 'rng', 'input'].includes(block.kind)
  );

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5" />
          Prompt Assembly Debug
        </CardTitle>
        <CardDescription>
          Detailed breakdown of prompt construction showing authored vs system-generated content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-500/5 rounded-lg border border-green-500/20">
            <div className="text-2xl font-bold text-green-400">{authoredBlocks.length}</div>
            <div className="text-sm text-green-300">Authored Blocks</div>
          </div>
          <div className="text-center p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-400">{systemGeneratedBlocks.length}</div>
            <div className="text-sm text-blue-300">System-Generated</div>
          </div>
          <div className="text-center p-3 bg-gray-500/5 rounded-lg border border-gray-500/20">
            <div className="text-2xl font-bold text-gray-400">{totalTokens || 'N/A'}</div>
            <div className="text-sm text-gray-300">Total Tokens</div>
          </div>
        </div>

        <Separator />

        {/* Assembly Order */}
        {assemblyOrder.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Assembly Order
            </h4>
            <div className="flex flex-wrap gap-2">
              {assemblyOrder.map((scope, index) => (
                <Badge key={scope} variant="outline" className="text-xs">
                  {index + 1}. {scope}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Segment IDs by Scope */}
        {Object.keys(segmentIdsByScope).length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Segment IDs by Scope</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {Object.entries(segmentIdsByScope).map(([scope, ids]) => (
                <div key={scope} className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <div className="font-medium">{scope}</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {ids.length} segment{ids.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Prompt Blocks */}
        <div>
          <h4 className="font-semibold mb-4">Prompt Blocks</h4>
          <ScrollArea className="h-96 w-full">
            <div className="space-y-4">
              {blocks.map((block, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium capitalize">{block.kind.replace('_', ' ')}</h5>
                      <BlockBadge kind={block.kind} />
                    </div>
                    {block.tokens && (
                      <Badge variant="outline" className="text-xs">
                        {block.tokens} tokens
                      </Badge>
                    )}
                  </div>
                  
                  {block.segmentIds && block.segmentIds.length > 0 && (
                    <div className="text-xs text-gray-500 mb-2">
                      Segment IDs: {block.segmentIds.join(', ')}
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded">
                    {block.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* System-Generated Info */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-blue-400 mt-0.5" />
            <div>
              <h5 className="font-medium text-blue-400 mb-1">System-Generated Layers</h5>
              <p className="text-sm text-blue-300">
                These layers are produced at runtime and not editable in Prompt Segments. 
                They include current game state, player information, random number generation context, and input processing.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
