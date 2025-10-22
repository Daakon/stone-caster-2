/**
 * Entry Assembly Preview Page
 * Shows the effective ruleset order for prompt assembly
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Copy, Check } from 'lucide-react';

import { entriesService, type Entry } from '@/services/admin.entries';

export default function EntryPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadEntry();
    }
  }, [id]);

  const loadEntry = async () => {
    try {
      setLoading(true);
      const entryData = await entriesService.getEntry(id!);
      setEntry(entryData);
    } catch (error) {
      console.error('Failed to load entry:', error);
      toast.error('Failed to load entry');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOrder = async () => {
    if (!entry) return;

    const orderText = `Entry: ${entry.name}
World: ${entry.world?.name || 'No world'}
Ruleset Order:
${entry.rulesets?.map((r, index) => `${index + 1}. ${r.name}`).join('\n') || 'No rulesets'}

NPCs: ${entry.npcs?.map(n => n.name).join(', ') || 'None'}
NPC Packs: ${entry.npc_packs?.map(p => p.name).join(', ') || 'None'}`;

    try {
      await navigator.clipboard.writeText(orderText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Assembly order copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading entry preview...</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Entry not found</p>
          <Button
            className="mt-4"
            onClick={() => navigate('/admin/entries')}
          >
            Back to Entries
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/entries/${entry.id}/edit`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Edit
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Assembly Preview</h1>
            <p className="text-muted-foreground">
              Effective ruleset order for prompt assembly
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={loadEntry}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCopyOrder}>
            {copied ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? 'Copied!' : 'Copy Order'}
          </Button>
        </div>
      </div>

      {/* Entry Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Entry Overview</CardTitle>
          <CardDescription>
            Basic information about this entry
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium">Name</h3>
              <p className="text-muted-foreground">{entry.name}</p>
            </div>
            <div>
              <h3 className="font-medium">Status</h3>
              <Badge className="bg-green-100 text-green-800">
                {entry.status}
              </Badge>
            </div>
            <div>
              <h3 className="font-medium">World</h3>
              <p className="text-muted-foreground">
                {entry.world?.name || 'No world assigned'}
              </p>
            </div>
            <div>
              <h3 className="font-medium">Description</h3>
              <p className="text-muted-foreground">
                {entry.description || 'No description'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assembly Order */}
      <Card>
        <CardHeader>
          <CardTitle>Prompt Assembly Order</CardTitle>
          <CardDescription>
            The order in which rulesets will be applied during prompt assembly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Core Ruleset */}
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                0
              </div>
              <div>
                <h3 className="font-medium">Core Ruleset</h3>
                <p className="text-sm text-muted-foreground">
                  Base system rules (always applied first)
                </p>
              </div>
            </div>

            <Separator />

            {/* Entry Rulesets */}
            {entry.rulesets && entry.rulesets.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-medium">Entry Rulesets (in order)</h3>
                {entry.rulesets.map((ruleset, index) => (
                  <div key={ruleset.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium">{ruleset.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Sort order: {ruleset.sort_order}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No rulesets assigned to this entry</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate(`/admin/entries/${entry.id}/edit`)}
                >
                  Add Rulesets
                </Button>
              </div>
            )}

            <Separator />

            {/* World Ruleset */}
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                W
              </div>
              <div>
                <h3 className="font-medium">World Ruleset</h3>
                <p className="text-sm text-muted-foreground">
                  {entry.world?.name || 'No world assigned'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NPC Sources */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Sources</CardTitle>
          <CardDescription>
            NPCs and NPC packs available in this entry
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Individual NPCs */}
            <div>
              <h3 className="font-medium mb-3">Individual NPCs</h3>
              {entry.npcs && entry.npcs.length > 0 ? (
                <div className="space-y-2">
                  {entry.npcs.map(npc => (
                    <div key={npc.id} className="flex items-center space-x-2">
                      <Badge variant="outline">{npc.name}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No individual NPCs assigned</p>
              )}
            </div>

            {/* NPC Packs */}
            <div>
              <h3 className="font-medium mb-3">NPC Packs</h3>
              {entry.npc_packs && entry.npc_packs.length > 0 ? (
                <div className="space-y-2">
                  {entry.npc_packs.map(pack => (
                    <div key={pack.id} className="flex items-center space-x-2">
                      <Badge variant="outline">{pack.name}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No NPC packs assigned</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assembly Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Assembly Notes</CardTitle>
          <CardDescription>
            Important information for the prompt assembly team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-800">Order Matters</h4>
              <p className="text-yellow-700">
                Rulesets are applied in the order shown above. Later rulesets can override earlier ones.
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800">Core Ruleset</h4>
              <p className="text-blue-700">
                The core ruleset is always applied first and provides the base system rules.
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800">World Ruleset</h4>
              <p className="text-green-700">
                World-specific rules are applied last and can override all other rulesets.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
