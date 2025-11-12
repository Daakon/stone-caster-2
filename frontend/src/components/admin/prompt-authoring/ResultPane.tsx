/**
 * Result Pane Component
 * Displays preview and budget results in tabs
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, CheckCircle2, Info, Copy, Check, HelpCircle, ExternalLink, History } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export interface PreviewResult {
  tp: any;
  linearized: string;
  warnings: string[];
  errors: string[];
  tokens?: {
    before: number;
    after?: number;
    trimPlan?: Array<{ key: string; removedTokens: number }>;
  };
}

export interface BudgetResult {
  tokens: {
    before: number;
    after: number;
  };
  trims: Array<{ key: string; removedChars: number; removedTokens: number }>;
  warnings: string[];
  sections: Array<{
    key: string;
    tokensBefore: number;
    tokensAfter: number;
    trimmed: boolean;
  }>;
}

export interface ResultPaneProps {
  previewResult: PreviewResult | null;
  budgetResult: BudgetResult | null;
  activeTab: 'preview' | 'budget';
  onTabChange: (tab: 'preview' | 'budget') => void;
  hasPartialContext?: boolean; // Show "Built with partial context" message
  templatesVersion?: number; // Templates version used
  moduleIds?: string[]; // Module IDs used
  moduleNames?: Record<string, string>; // Module names by ID
  presetIds?: string[]; // Preset IDs used
  extrasModified?: boolean; // Whether extras were modified
  storyId?: string; // Story ID for snapshot history link
}

export function ResultPane({
  previewResult,
  budgetResult,
  activeTab,
  onTabChange,
  hasPartialContext = false,
  templatesVersion,
  moduleIds = [],
  moduleNames = {},
  presetIds = [],
  extrasModified = false,
  storyId,
}: ResultPaneProps) {
  const [copied, setCopied] = useState<string | null>(null);
  
  // Build audit breadcrumbs
  const breadcrumbs = [];
  if (templatesVersion !== undefined) {
    breadcrumbs.push(`templatesVersion: ${templatesVersion}`);
  } else {
    breadcrumbs.push('templatesVersion: Latest');
  }
  
  if (moduleIds.length > 0) {
    const moduleList = moduleIds.slice(0, 3).map(id => moduleNames[id] || id.substring(0, 8)).join(', ');
    const moreCount = moduleIds.length - 3;
    breadcrumbs.push(`modules: ${moduleList}${moreCount > 0 ? ` +${moreCount} more` : ''}`);
  }
  
  if (presetIds.length > 0) {
    breadcrumbs.push(`presets: ${presetIds.join(', ')}`);
  }
  
  breadcrumbs.push(`extras modified: ${extrasModified ? 'yes' : 'no'}`);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`Copied ${label} to clipboard`);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Results
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="How prompts are built">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" aria-label="How prompts are built help">
                  <div className="space-y-2">
                    <h4 className="font-semibold">How prompts are built</h4>
                    <p className="text-sm text-muted-foreground">
                      Prompts are assembled from:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      <li>Templates (slots)</li>
                      <li>Extras</li>
                      <li>Module Params</li>
                      <li>Context (world/ruleset/scenario/NPCs)</li>
                      <li>Budget (token limits)</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-2">
                      Preview uses temporary overrides; Save writes to packs/stories.
                    </p>
                    <Button variant="link" size="sm" className="p-0 h-auto" asChild>
                      <Link to="/admin/docs/prompt-authoring">
                        View full docs <ExternalLink className="h-3 w-3 ml-1 inline" />
                      </Link>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </CardTitle>
            <CardDescription>Preview and budget analysis</CardDescription>
          </div>
        </div>
        
        {/* Audit Breadcrumbs */}
        {(breadcrumbs.length > 0 || storyId) && (
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <div className="flex flex-wrap gap-2 items-center">
              {breadcrumbs.map((crumb, idx) => (
                <Badge key={idx} variant="outline" className="text-xs font-normal">
                  {crumb}
                </Badge>
              ))}
              {storyId && (
                <Link to={`/admin/prompt-snapshots?gameId=${storyId}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <History className="h-3 w-3" />
                  View snapshot history
                </Link>
              )}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'preview' | 'budget')} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">
              Preview
              {previewResult && (
                <Badge variant="outline" className="ml-2">
                  {previewResult.tokens?.before || 0}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="budget">
              Budget
              {budgetResult && (
                <Badge variant="outline" className="ml-2">
                  {budgetResult.tokens.after}/{budgetResult.tokens.before}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 flex flex-col min-h-0 mt-4">
            {previewResult ? (
              <div className="flex-1 flex flex-col space-y-4 min-h-0">
                {/* Partial Context Warning */}
                {hasPartialContext && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Built with partial context:</strong> World or ruleset information was not available. The preview may be incomplete.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Warnings and Errors */}
                {(previewResult.warnings?.length > 0 || previewResult.errors?.length > 0) && (
                  <div className="space-y-2">
                    {previewResult.errors?.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-semibold mb-1">Errors</div>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {previewResult.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    {previewResult.warnings?.length > 0 && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-semibold mb-1">Warnings</div>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {previewResult.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Token Info */}
                {previewResult.tokens && (
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      Before: {previewResult.tokens.before} tokens
                    </Badge>
                    {previewResult.tokens.after !== undefined && (
                      <Badge variant="outline">
                        After: {previewResult.tokens.after} tokens
                      </Badge>
                    )}
                  </div>
                )}

                {/* Tabs for JSON and Linearized */}
                <Tabs defaultValue="linearized" className="flex-1 flex flex-col min-h-0">
                  <TabsList role="tablist" aria-label="Preview format tabs">
                    <TabsTrigger value="linearized" role="tab" aria-label="Linearized prompt text">Linearized</TabsTrigger>
                    <TabsTrigger value="json" role="tab" aria-label="TurnPacketV3 JSON">TurnPacketV3 (JSON)</TabsTrigger>
                  </TabsList>
                  <TabsContent value="linearized" className="flex-1 flex flex-col min-h-0 mt-2">
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(previewResult.linearized, 'Linearized')}
                        aria-label="Copy linearized prompt to clipboard"
                      >
                        {copied === 'Linearized' ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Linearized
                          </>
                        )}
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 border rounded-md p-4">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {previewResult.linearized}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="json" className="flex-1 flex flex-col min-h-0 mt-2">
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(JSON.stringify(previewResult.tp, null, 2), 'JSON')}
                        aria-label="Copy TurnPacket JSON to clipboard"
                      >
                        {copied === 'JSON' ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy JSON
                          </>
                        )}
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 border rounded-md p-4">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {JSON.stringify(previewResult.tp, null, 2)}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No preview generated yet</p>
                  <p className="text-sm">Click "Preview" to generate</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="budget" className="flex-1 flex flex-col min-h-0 mt-4">
            {budgetResult ? (
              <div className="flex-1 flex flex-col space-y-4 min-h-0">
                {/* Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Tokens</span>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {budgetResult.tokens.after} / {budgetResult.tokens.before}
                      </Badge>
                      <Badge variant={budgetResult.tokens.after <= budgetResult.tokens.before ? 'default' : 'destructive'}>
                        {Math.round((budgetResult.tokens.after / budgetResult.tokens.before) * 100)}%
                      </Badge>
                    </div>
                  </div>
                  {budgetResult.trims.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Trims: </span>
                      <span className="text-sm text-muted-foreground">
                        {budgetResult.trims.length} sections trimmed
                      </span>
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {budgetResult.warnings?.length > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-1">Warnings</div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {budgetResult.warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Sections */}
                <div className="flex-1 flex flex-col min-h-0">
                  <h4 className="text-sm font-semibold mb-2">Sections</h4>
                  <ScrollArea className="flex-1 border rounded-md">
                    <div className="p-4 space-y-2">
                      {budgetResult.sections.map((section, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 border rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1 rounded">
                              {section.key}
                            </code>
                            {section.trimmed && (
                              <Badge variant="destructive" className="text-xs">
                                Trimmed
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2 text-muted-foreground">
                            <span>{section.tokensAfter}</span>
                            <span>/</span>
                            <span>{section.tokensBefore}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Trims Detail */}
                {budgetResult.trims.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Trim Details</h4>
                    <ScrollArea className="border rounded-md max-h-48">
                      <div className="p-4 space-y-2">
                        {budgetResult.trims.map((trim, i) => (
                          <div key={i} className="text-sm">
                            <code className="text-xs bg-muted px-1 rounded">{trim.key}</code>
                            <span className="text-muted-foreground ml-2">
                              -{trim.removedTokens} tokens ({trim.removedChars} chars)
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No budget report generated yet</p>
                  <p className="text-sm">Click "Budget" to generate</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

