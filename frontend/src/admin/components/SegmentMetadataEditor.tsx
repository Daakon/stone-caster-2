/**
 * Segment Metadata Editor Component
 * Phase 4: JSON metadata editor with schema validation and hints
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Code, Settings } from 'lucide-react';

interface SegmentMetadataEditorProps {
  value: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  scope: string;
}

export function SegmentMetadataEditor({ value, onChange, scope }: SegmentMetadataEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    locale: '',
    kind: '',
    tier: '',
    notes: ''
  });

  // Initialize form data from value
  useEffect(() => {
    setFormData({
      locale: value.locale || '',
      kind: value.kind || '',
      tier: value.tier?.toString() || '',
      notes: value.notes || ''
    });
  }, [value]);

  // Initialize JSON value
  useEffect(() => {
    setJsonValue(JSON.stringify(value, null, 2));
  }, [value]);

  const handleFormChange = (field: string, newValue: string) => {
    const updatedFormData = { ...formData, [field]: newValue };
    setFormData(updatedFormData);

    const metadata = { ...value };
    if (newValue) {
      if (field === 'tier') {
        metadata[field] = parseInt(newValue) || 0;
      } else {
        metadata[field] = newValue;
      }
    } else {
      delete metadata[field];
    }

    onChange(metadata);
  };

  const handleJsonChange = (newJsonValue: string) => {
    setJsonValue(newJsonValue);
    
    try {
      const parsed = JSON.parse(newJsonValue);
      setJsonError(null);
      onChange(parsed);
    } catch (error) {
      setJsonError('Invalid JSON format');
    }
  };

  const switchToJsonMode = () => {
    setIsJsonMode(true);
    setJsonValue(JSON.stringify(value, null, 2));
  };

  const switchToFormMode = () => {
    if (!jsonError) {
      setIsJsonMode(false);
    }
  };

  const getScopeHints = () => {
    const hints = {
      core: {
        kind: ['baseline', 'system', 'global'],
        tier: 'Not applicable for core segments',
        locale: 'System-wide language'
      },
      ruleset: {
        kind: ['baseline', 'rules', 'mechanics'],
        tier: 'Not applicable for ruleset segments',
        locale: 'Ruleset language'
      },
      world: {
        kind: ['baseline', 'setting', 'atmosphere'],
        tier: 'Not applicable for world segments',
        locale: 'World language'
      },
      entry: {
        kind: ['main', 'intro', 'description'],
        tier: 'Not applicable for entry segments',
        locale: 'Entry language'
      },
      entry_start: {
        kind: ['start', 'intro', 'hook'],
        tier: 'Not applicable for entry start segments',
        locale: 'Entry start language'
      },
      npc: {
        kind: ['dialogue', 'personality', 'description'],
        tier: '0-3 (0=common, 3=rare)',
        locale: 'NPC language'
      },
      game_state: {
        kind: ['state', 'transition', 'update'],
        tier: 'Not applicable for game state segments',
        locale: 'Game state language'
      },
      player: {
        kind: ['personal', 'character', 'stats'],
        tier: 'Not applicable for player segments',
        locale: 'Player language'
      },
      rng: {
        kind: ['random', 'chance', 'probability'],
        tier: 'Not applicable for RNG segments',
        locale: 'RNG language'
      },
      input: {
        kind: ['input', 'parsing', 'validation'],
        tier: 'Not applicable for input segments',
        locale: 'Input language'
      }
    };

    return hints[scope as keyof typeof hints] || hints.core;
  };

  const getCommonLocales = () => [
    'en', 'en-US', 'en-GB', 'es', 'es-ES', 'fr', 'fr-FR', 'de', 'de-DE', 
    'it', 'it-IT', 'pt', 'pt-BR', 'ru', 'ru-RU', 'ja', 'ja-JP', 'ko', 'ko-KR',
    'zh', 'zh-CN', 'zh-TW'
  ];

  const getCommonKinds = () => {
    const hints = getScopeHints();
    return hints.kind;
  };

  const isTierApplicable = () => {
    return scope === 'npc';
  };

  const hints = getScopeHints();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Metadata
        </CardTitle>
        <CardDescription>
          Additional metadata for this segment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={isJsonMode ? 'json' : 'form'} onValueChange={(value) => setIsJsonMode(value === 'json')}>
          <TabsList>
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Locale */}
              <div className="space-y-2">
                <Label htmlFor="locale">Locale</Label>
                <Select
                  value={formData.locale}
                  onValueChange={(value) => handleFormChange('locale', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select locale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No locale (default)</SelectItem>
                    {getCommonLocales().map(locale => (
                      <SelectItem key={locale} value={locale}>
                        {locale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{hints.locale}</p>
              </div>

              {/* Kind */}
              <div className="space-y-2">
                <Label htmlFor="kind">Kind</Label>
                <Select
                  value={formData.kind}
                  onValueChange={(value) => handleFormChange('kind', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select kind" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No kind</SelectItem>
                    {getCommonKinds().map(kind => (
                      <SelectItem key={kind} value={kind}>
                        {kind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Available: {hints.kind.join(', ')}</p>
              </div>

              {/* Tier (NPC only) */}
              {isTierApplicable() && (
                <div className="space-y-2">
                  <Label htmlFor="tier">Tier</Label>
                  <Select
                    value={formData.tier}
                    onValueChange={(value) => handleFormChange('tier', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No tier</SelectItem>
                      <SelectItem value="0">0 - Common</SelectItem>
                      <SelectItem value="1">1 - Uncommon</SelectItem>
                      <SelectItem value="2">2 - Rare</SelectItem>
                      <SelectItem value="3">3 - Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{hints.tier}</p>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="json" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="json">JSON Metadata</Label>
              <Textarea
                id="json"
                value={jsonValue}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder='{"locale": "en", "kind": "baseline", "tier": 0}'
                rows={8}
                className="font-mono text-sm"
              />
              {jsonError && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{jsonError}</AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Current metadata preview */}
        {Object.keys(value).length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Current metadata:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(value).map(([key, val]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {key}: {typeof val === 'string' ? val : JSON.stringify(val)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
