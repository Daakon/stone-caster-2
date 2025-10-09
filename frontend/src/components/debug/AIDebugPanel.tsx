/**
 * AI Debug Panel - Displays prompt state and AI response for debugging
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, ChevronDown, ChevronRight, Clock, Hash, FileText } from 'lucide-react';

interface DebugInfo {
  promptState?: {
    gameContext: any;
    optionId: string;
    choices: Array<{id: string, label: string}>;
    timestamp: string;
  };
  promptText?: string;
  aiResponseRaw?: string;
  processingTime?: number;
  tokenCount?: number;
  repairAttempted?: boolean;
  fallback?: boolean;
  error?: string;
}

interface AIDebugPanelProps {
  debugInfo?: DebugInfo;
  className?: string;
}

export function AIDebugPanel({ debugInfo, className }: AIDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (!debugInfo) {
    return null;
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={`border-orange-200 bg-orange-50 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-orange-800">
            AI Debug Panel
          </CardTitle>
          <div className="flex items-center gap-2">
            {debugInfo.fallback && (
              <Badge variant="destructive" className="text-xs">
                Fallback
              </Badge>
            )}
            {debugInfo.repairAttempted && (
              <Badge variant="secondary" className="text-xs">
                Repaired
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="prompt" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Prompt
              </TabsTrigger>
              <TabsTrigger value="response" className="text-xs">
                <Hash className="h-3 w-3 mr-1" />
                Response
              </TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Metrics
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="prompt" className="mt-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Prompt State</h4>
                  <div className="bg-gray-100 p-3 rounded-md">
                    <div className="text-xs text-gray-600 mb-2">
                      Timestamp: {debugInfo.promptState?.timestamp && formatTimestamp(debugInfo.promptState.timestamp)}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      Option ID: {debugInfo.promptState?.optionId}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      Choices: {debugInfo.promptState?.choices?.length || 0}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(
                        formatJSON(debugInfo.promptState), 
                        'promptState'
                      )}
                      className="mt-2"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copied === 'promptState' ? 'Copied!' : 'Copy State'}
                    </Button>
                  </div>
                </div>
                
                {debugInfo.promptText && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Full Prompt Text</h4>
                    <ScrollArea className="h-64 w-full border rounded-md">
                      <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                        {debugInfo.promptText}
                      </pre>
                    </ScrollArea>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(debugInfo.promptText!, 'promptText')}
                      className="mt-2"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copied === 'promptText' ? 'Copied!' : 'Copy Prompt'}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="response" className="mt-4">
              <div className="space-y-4">
                {debugInfo.aiResponseRaw && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Raw AI Response</h4>
                    <ScrollArea className="h-64 w-full border rounded-md">
                      <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                        {debugInfo.aiResponseRaw}
                      </pre>
                    </ScrollArea>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(debugInfo.aiResponseRaw!, 'aiResponse')}
                      className="mt-2"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copied === 'aiResponse' ? 'Copied!' : 'Copy Response'}
                    </Button>
                  </div>
                )}
                
                {debugInfo.error && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-red-600">Error</h4>
                    <div className="bg-red-50 p-3 rounded-md">
                      <pre className="text-xs text-red-700 whitespace-pre-wrap">
                        {debugInfo.error}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="metrics" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-blue-800">Processing Time</div>
                    <div className="text-lg font-bold text-blue-900">
                      {debugInfo.processingTime ? `${debugInfo.processingTime}ms` : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-green-800">Token Count</div>
                    <div className="text-lg font-bold text-green-900">
                      {debugInfo.tokenCount || 'N/A'}
                    </div>
                  </div>
                </div>
                
                {debugInfo.promptText && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-800">Prompt Size</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatBytes(debugInfo.promptText.length)}
                    </div>
                  </div>
                )}
                
                {debugInfo.aiResponseRaw && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-800">Response Size</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatBytes(debugInfo.aiResponseRaw.length)}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}


