import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { apiGet, apiDelete } from '../../lib/api';

interface DebugStats {
  totalPrompts: number;
  totalResponses: number;
  totalStateChanges: number;
  games: string[];
  latestActivity: string;
}

interface DebugPrompt {
  id: string;
  timestamp: string;
  gameId: string;
  turnIndex: number;
  world: string;
  character?: string;
  prompt: string;
  audit: any;
  metadata: any;
}

interface DebugResponse {
  id: string;
  timestamp: string;
  gameId: string;
  turnIndex: number;
  promptId: string;
  response: any;
  processingTime: number;
  tokenCount?: number;
}

interface DebugStateChange {
  id: string;
  timestamp: string;
  gameId: string;
  turnIndex: number;
  responseId: string;
  actions: any[];
  changes: any[];
  beforeState: any;
  afterState: any;
}

interface DebugPanelProps {
  gameId?: string;
  isVisible: boolean;
  onToggle: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ gameId, isVisible, onToggle }) => {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [prompts, setPrompts] = useState<DebugPrompt[]>([]);
  const [responses, setResponses] = useState<DebugResponse[]>([]);
  const [stateChanges, setStateChanges] = useState<DebugStateChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      if (gameId) {
        // Fetch data for specific game
        const gameData = await apiGet(`/debug/game/${gameId}`);
        
        if (gameData.ok) {
          const data = gameData.data as any;
          setPrompts(data.prompts || []);
          setResponses(data.aiResponses || []);
          setStateChanges(data.stateChanges || []);
        }
      } else {
        // Fetch all data
        const [statsData, promptsData, responsesData, stateChangesData] = await Promise.all([
          apiGet('/debug/stats'),
          apiGet('/debug/prompts'),
          apiGet('/debug/responses'),
          apiGet('/debug/state-changes')
        ]);
        
        if (statsData.ok) setStats(statsData.data as DebugStats);
        if (promptsData.ok) setPrompts((promptsData.data as DebugPrompt[]) || []);
        if (responsesData.ok) setResponses((responsesData.data as DebugResponse[]) || []);
        if (stateChangesData.ok) setStateChanges((stateChangesData.data as DebugStateChange[]) || []);
      }
    } catch (error) {
      console.error('Error fetching debug data:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearDebugData = async () => {
    try {
      await apiDelete('/debug/clear');
      await fetchDebugData();
    } catch (error) {
      console.error('Error clearing debug data:', error);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchDebugData();
    }
  }, [isVisible, gameId]);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={onToggle} variant="outline" size="sm">
          🐛 Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] z-50">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Debug Panel</CardTitle>
            <div className="flex gap-2">
              <Button onClick={fetchDebugData} variant="outline" size="sm" disabled={loading}>
                {loading ? '...' : '↻'}
              </Button>
              <Button onClick={clearDebugData} variant="outline" size="sm">
                🗑️
              </Button>
              <Button onClick={onToggle} variant="outline" size="sm">
                ✕
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100%-4rem)]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="stats">Stats</TabsTrigger>
              <TabsTrigger value="prompts">Prompts</TabsTrigger>
              <TabsTrigger value="responses">AI</TabsTrigger>
              <TabsTrigger value="wrapper">Wrapper</TabsTrigger>
              <TabsTrigger value="changes">State</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stats" className="h-[calc(100%-3rem)] p-4">
              <ScrollArea className="h-full">
                {stats ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{stats.totalPrompts}</div>
                        <div className="text-xs text-muted-foreground">Prompts</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{stats.totalResponses}</div>
                        <div className="text-xs text-muted-foreground">AI Responses</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{stats.totalStateChanges}</div>
                        <div className="text-xs text-muted-foreground">State Changes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{stats.games.length}</div>
                        <div className="text-xs text-muted-foreground">Games</div>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-sm font-medium">Active Games</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {stats.games.map(game => (
                          <Badge key={game} variant="secondary" className="text-xs">
                            {game.substring(0, 8)}...
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Latest Activity</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(stats.latestActivity).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">No stats available</div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="prompts" className="h-[calc(100%-3rem)] p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {prompts.map(prompt => (
                    <Card key={prompt.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {prompt.world}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Turn {prompt.turnIndex}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {prompt.character || 'Guest'} • {new Date(prompt.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs">
                        <div>Tokens: {prompt.audit.tokenCount}</div>
                        <div>Templates: {prompt.metadata.totalSegments}</div>
                      </div>
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer">View Prompt</summary>
                        <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                          {prompt.prompt.substring(0, 500)}...
                        </pre>
                      </details>
                    </Card>
                  ))}
                  {prompts.length === 0 && (
                    <div className="text-center text-muted-foreground">No prompts available</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="responses" className="h-[calc(100%-3rem)] p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {responses.map(response => (
                    <Card key={response.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {response.processingTime}ms
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Turn {response.turnIndex}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {new Date(response.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs">
                        <div>Tokens: {response.tokenCount || 'N/A'}</div>
                        <div>Actions: {response.response.acts?.length || 0}</div>
                        <div>Choices: {response.response.choices?.length || 0}</div>
                        {response.response.debug && (
                          <div className="mt-2 p-2 bg-orange-50 rounded border border-orange-200">
                            <div className="text-xs font-medium text-orange-800 mb-1">Debug Info</div>
                            <div className="text-xs text-orange-700">
                              <div>Prompt Size: {response.response.debug.promptText?.length || 0} chars</div>
                              <div>Raw Response: {response.response.debug.aiResponseRaw?.length || 0} chars</div>
                              {response.response.debug.repairAttempted && (
                                <div className="text-orange-600">⚠️ JSON Repair Applied</div>
                              )}
                              {response.response.debug.fallback && (
                                <div className="text-red-600">⚠️ Fallback Response</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer">View Response</summary>
                        <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                          {JSON.stringify(response.response, null, 2).substring(0, 500)}...
                        </pre>
                      </details>
                      {response.response.debug && (
                        <details className="mt-2">
                        <summary className="text-xs cursor-pointer">View Debug Data</summary>
                        <div className="mt-2 space-y-2">
                          {response.response.debug.promptText && (
                            <div>
                              <div className="text-xs font-medium mb-1">Prompt Text:</div>
                              <pre className="text-xs p-2 bg-muted rounded overflow-auto max-h-32">
                                {response.response.debug.promptText.substring(0, 1000)}...
                              </pre>
                            </div>
                          )}
                          {response.response.debug.aiResponseRaw && (
                            <div>
                              <div className="text-xs font-medium mb-1">Raw AI Response:</div>
                              <pre className="text-xs p-2 bg-muted rounded overflow-auto max-h-32">
                                {response.response.debug.aiResponseRaw.substring(0, 1000)}...
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                      )}
                    </Card>
                  ))}
                  {responses.length === 0 && (
                    <div className="text-center text-muted-foreground">No AI responses available</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="wrapper" className="h-[calc(100%-3rem)] p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {responses
                    .filter(response => response.response.debug)
                    .map(response => (
                    <Card key={response.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {response.processingTime}ms
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Turn {response.turnIndex}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {new Date(response.timestamp).toLocaleTimeString()}
                      </div>
                      
                      {response.response.debug && (
                        <div className="space-y-3">
                          <div className="p-2 bg-blue-50 rounded border border-blue-200">
                            <div className="text-xs font-medium text-blue-800 mb-1">Prompt State</div>
                            <div className="text-xs text-blue-700">
                              <div>Option ID: {response.response.debug.promptState?.optionId}</div>
                              <div>Choices: {response.response.debug.promptState?.choices?.length || 0}</div>
                              <div>Timestamp: {response.response.debug.promptState?.timestamp && 
                                new Date(response.response.debug.promptState.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-2 bg-green-50 rounded border border-green-200">
                            <div className="text-xs font-medium text-green-800 mb-1">Performance</div>
                            <div className="text-xs text-green-700">
                              <div>Processing Time: {response.response.debug.processingTime}ms</div>
                              <div>Token Count: {response.response.debug.tokenCount || 'N/A'}</div>
                              <div>Prompt Size: {response.response.debug.promptText?.length || 0} chars</div>
                            </div>
                          </div>
                          
                          {response.response.debug.repairAttempted && (
                            <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                              <div className="text-xs font-medium text-yellow-800">⚠️ JSON Repair Applied</div>
                            </div>
                          )}
                          
                          {response.response.debug.fallback && (
                            <div className="p-2 bg-red-50 rounded border border-red-200">
                              <div className="text-xs font-medium text-red-800">⚠️ Fallback Response</div>
                              {response.response.debug.error && (
                                <div className="text-xs text-red-700 mt-1">
                                  Error: {response.response.debug.error}
                                </div>
                              )}
                            </div>
                          )}
                          
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer">View Full Prompt</summary>
                            <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                              {response.response.debug.promptText?.substring(0, 1000)}...
                            </pre>
                          </details>
                          
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer">View Raw AI Response</summary>
                            <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                              {response.response.debug.aiResponseRaw?.substring(0, 1000)}...
                            </pre>
                          </details>
                        </div>
                      )}
                    </Card>
                  ))}
                  {responses.filter(response => response.response.debug).length === 0 && (
                    <div className="text-center text-muted-foreground">No wrapper debug data available</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="changes" className="h-[calc(100%-3rem)] p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {stateChanges.map(change => (
                    <Card key={change.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {change.actions.length} actions
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Turn {change.turnIndex}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {new Date(change.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs">
                        <div>Changes: {change.changes.length}</div>
                        <div>Scene: {change.afterState?.currentScene || 'N/A'}</div>
                      </div>
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer">View Changes</summary>
                        <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                          {JSON.stringify(change.changes, null, 2).substring(0, 500)}...
                        </pre>
                      </details>
                    </Card>
                  ))}
                  {stateChanges.length === 0 && (
                    <div className="text-center text-muted-foreground">No state changes available</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
