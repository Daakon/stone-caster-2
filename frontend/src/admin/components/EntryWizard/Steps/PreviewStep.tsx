import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Zap,
  FileText,
  Users,
  Globe
} from 'lucide-react';
import { EntryPoint } from '@/services/admin.entryPoints';
import { WizardData } from '../EntryWizard';
import { TokenMeter } from '@/ui/lib/tokenMeter';

interface PreviewStepProps {
  entry: EntryPoint;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (stepData: any) => void;
}

interface PreviewData {
  entry: {
    id: string;
    name: string;
    slug: string;
  };
  world: {
    id: string;
    name: string;
    slug: string;
  };
  rulesets: Array<{
    id: string;
    name: string;
    sort_order: number;
  }>;
  npcs: Array<{
    id: string;
    name: string;
    tier?: number;
  }>;
  prompt: string;
  meta: {
    segmentIdsByScope: Record<string, string[]>;
    budgets: {
      maxTokens: number;
      estTokens: number;
    };
    truncationMeta: any;
    assemblerVersion: string;
    locale: string;
  };
  lints: Array<{
    code: string;
    level: 'warn' | 'error';
    message: string;
  }>;
}

export function PreviewStep({ entry, data, onUpdate, onComplete }: PreviewStepProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locale, setLocale] = useState('en');
  const [firstTurn, setFirstTurn] = useState(true);
  const [maxTokens, setMaxTokens] = useState(800);
  const [copied, setCopied] = useState(false);
  
  const loadPreview = async () => {
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({
        locale,
        firstTurn: firstTurn.toString(),
        maxTokens: maxTokens.toString(),
        npcIds: data.npcIds?.join(',') || '',
      });
      
      const response = await fetch(`/api/entries/${entry.id}/preview?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to load preview');
      }
      
      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (data.worldId && data.rulesetIds && data.rulesetIds.length > 0) {
      loadPreview();
    }
  }, [entry.id, data.worldId, data.rulesetIds, data.npcIds, locale, firstTurn, maxTokens]);
  
  const handleCopyPrompt = async () => {
    if (previewData?.prompt) {
      await navigator.clipboard.writeText(previewData.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleStartTestChat = async () => {
    try {
      // TODO: Create game with entry_id and redirect to chat
      // This would typically call the create game API and redirect
    } catch (error) {
    }
  };
  
  const getLintIcon = (level: string) => {
    return level === 'error' ? (
      <AlertCircle className="h-4 w-4 text-red-500" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
    );
  };
  
  const getLintColor = (level: string) => {
    return level === 'error' ? 'destructive' : 'default';
  };
  
  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Preview Controls</CardTitle>
          <CardDescription>
            Configure the preview settings and generate the assembled prompt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="locale">Locale</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="max-tokens">Max Tokens</Label>
              <Select value={maxTokens.toString()} onValueChange={(v) => setMaxTokens(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">400</SelectItem>
                  <SelectItem value="800">800</SelectItem>
                  <SelectItem value="1200">1200</SelectItem>
                  <SelectItem value="1600">1600</SelectItem>
                  <SelectItem value="2000">2000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="first-turn"
                checked={firstTurn}
                onCheckedChange={setFirstTurn}
              />
              <Label htmlFor="first-turn">First Turn</Label>
            </div>
            
            <div className="flex items-center">
              <Button 
                onClick={loadPreview} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Loading...' : 'Refresh Preview'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Token Meter */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Token Budget
            </CardTitle>
            <CardDescription>
              Monitor token usage and budget constraints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TokenMeter
              current={previewData.meta.budgets.estTokens}
              max={previewData.meta.budgets.maxTokens}
              showDetails={true}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Lints */}
      {previewData && previewData.lints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Issues Found
            </CardTitle>
            <CardDescription>
              Review and fix these issues before publishing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {previewData.lints.map((lint, index) => (
                <Alert key={index} variant={getLintColor(lint.level)}>
                  {getLintIcon(lint.level)}
                  <AlertDescription>
                    <strong>{lint.code}:</strong> {lint.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Assembly Info */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Assembly Information
            </CardTitle>
            <CardDescription>
              Details about the prompt assembly process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>World</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Globe className="h-4 w-4" />
                  <span>{previewData.world.name}</span>
                </div>
              </div>
              
              <div>
                <Label>Rulesets</Label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {previewData.rulesets.map((ruleset, index) => (
                    <Badge key={ruleset.id} variant="outline">
                      {index + 1}. {ruleset.name}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <Label>NPCs</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Users className="h-4 w-4" />
                  <span>{previewData.npcs.length} selected</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <Label>Segment Coverage</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {Object.entries(previewData.meta.segmentIdsByScope).map(([scope, ids]) => (
                  <div key={scope} className="flex items-center gap-2">
                    <Badge variant="outline">{scope}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {ids.length} segment{ids.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Assembled Prompt */}
      {previewData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Assembled Prompt</CardTitle>
                <CardDescription>
                  The complete prompt that will be sent to the AI model
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={previewData.prompt}
              readOnly
              className="min-h-[400px] font-mono text-sm"
              placeholder="Preview will appear here..."
            />
          </CardContent>
        </Card>
      )}
      
      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => onComplete({})}>
          Skip Preview
        </Button>
        
        <div className="flex gap-2">
          <Button
            onClick={handleStartTestChat}
            disabled={!previewData || previewData.lints.some(l => l.level === 'error')}
          >
            <Play className="h-4 w-4 mr-2" />
            Start Test Chat
          </Button>
          
          <Button
            onClick={() => onComplete({ previewData })}
            disabled={previewData?.lints.some(l => l.level === 'error')}
          >
            Complete Setup
          </Button>
        </div>
      </div>
    </div>
  );
}
