/**
 * Prompt Preview Form Component
 * Form for selecting world/ruleset/scenario/NPCs and templates version
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface PromptPreviewFormProps {
  onSubmit: (params: {
    worldId?: string;
    rulesetId?: string;
    scenarioId?: string;
    npcIds?: string[];
    templatesVersion?: number;
  }) => void;
  isLoading: boolean;
  initialTemplatesVersion?: number;
}

export function PromptPreviewForm({
  onSubmit,
  isLoading,
  initialTemplatesVersion,
}: PromptPreviewFormProps) {
  const [worldId, setWorldId] = useState('');
  const [rulesetId, setRulesetId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [npcIds, setNpcIds] = useState<string[]>([]);
  const [templatesVersion, setTemplatesVersion] = useState<number | 'latest'>(
    initialTemplatesVersion || 'latest'
  );

  // Fetch available template versions
  const { data: versions } = useQuery({
    queryKey: ['admin', 'templates', 'versions'],
    queryFn: async () => {
      const res = await api.get('/api/admin/templates/versions');
      if (!res.ok) throw new Error('Failed to fetch versions');
      return res.data as number[];
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      worldId: worldId || undefined,
      rulesetId: rulesetId || undefined,
      scenarioId: scenarioId || undefined,
      npcIds: npcIds.length > 0 ? npcIds : undefined,
      templatesVersion: templatesVersion === 'latest' ? undefined : templatesVersion,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>World ID</Label>
          <Input
            value={worldId}
            onChange={(e) => setWorldId(e.target.value)}
            placeholder="Enter world ID"
          />
        </div>
        <div>
          <Label>Ruleset ID</Label>
          <Input
            value={rulesetId}
            onChange={(e) => setRulesetId(e.target.value)}
            placeholder="Enter ruleset ID"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Scenario ID (Optional)</Label>
          <Input
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            placeholder="Enter scenario ID"
          />
        </div>
        <div>
          <Label>Templates Version</Label>
          <Select
            value={templatesVersion === 'latest' ? 'latest' : String(templatesVersion)}
            onValueChange={(v) => setTemplatesVersion(v === 'latest' ? 'latest' : parseInt(v, 10))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest Published</SelectItem>
              {versions?.map((v) => (
                <SelectItem key={v} value={String(v)}>
                  Version {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>NPC IDs (Comma-separated, Optional)</Label>
        <Input
          value={npcIds.join(', ')}
          onChange={(e) => setNpcIds(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="npc-1, npc-2, ..."
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating Preview...
          </>
        ) : (
          'Generate Preview'
        )}
      </Button>
    </form>
  );
}

