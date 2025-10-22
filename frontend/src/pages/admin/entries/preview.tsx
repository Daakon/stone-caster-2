/**
 * Entry Preview Page with Bundle Preview
 * Shows the effective ruleset order and runtime JSON for an entry
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { entriesService } from '@/services/admin.entries';
import { bundlePreviewService } from '@/services/admin.bundlePreview';
import { ArrowLeft, Copy, Download, Eye, AlertTriangle, CheckCircle } from 'lucide-react';

export default function EntryPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<any>(null);
  const [bundlePreview, setBundlePreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewOptions, setPreviewOptions] = useState({
    includeDrafts: false,
    maxSize: 32000
  });

  useEffect(() => {
    if (id) {
      loadEntry();
    }
  }, [id]);

  const loadEntry = async () => {
    try {
      setLoading(true);
      const data = await entriesService.getEntry(id!);
      setEntry(data);
      
      // Generate bundle preview
      const preview = await bundlePreviewService.generatePreview(id!, previewOptions);
      setBundlePreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entry');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!bundlePreview) return;

    try {
      const result = await bundlePreviewService.copyToClipboard(id!, previewOptions);
      if (result.success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setError(result.error || 'Failed to copy to clipboard');
      }
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleDownloadJSON = async () => {
    if (!bundlePreview) return;

    try {
      const result = await bundlePreviewService.generateRuntimeJSON(id!, previewOptions);
      if (result.success) {
        const filename = `${entry.name.toLowerCase().replace(/\s+/g, '-')}-bundle.json`;
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        setError(result.error || 'Failed to generate JSON');
      }
    } catch (err) {
      setError('Failed to download JSON');
    }
  };

  const handleRefreshPreview = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const preview = await bundlePreviewService.generatePreview(id, previewOptions);
      setBundlePreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh preview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading entry...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <Button onClick={() => navigate('/admin/entries')} className="mt-4">
          Back to Entries
        </Button>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Entry not found</p>
        <Button onClick={() => navigate('/admin/entries')} className="mt-4">
          Back to Entries
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/entries')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{entry.name}</h1>
            <p className="text-gray-600">Bundle Preview & Assembly Order</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={handleRefreshPreview}
            variant="outline"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleDownloadJSON}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download JSON
          </Button>
        </div>
      </div>

      {/* Preview Options */}
      <Card>
        <CardHeader>
          <CardTitle>Preview Options</CardTitle>
          <CardDescription>
            Configure what to include in the bundle preview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <Checkbox
                checked={previewOptions.includeDrafts}
                onCheckedChange={(checked) => setPreviewOptions(prev => ({
                  ...prev,
                  includeDrafts: checked as boolean
                }))}
              />
              <span className="text-sm">Include draft rulesets</span>
            </label>
            <div className="flex items-center space-x-2">
              <label className="text-sm">Max size:</label>
              <input
                type="number"
                value={previewOptions.maxSize}
                onChange={(e) => setPreviewOptions(prev => ({
                  ...prev,
                  maxSize: parseInt(e.target.value) || 32000
                }))}
                className="w-20 px-2 py-1 border rounded text-sm"
              />
              <span className="text-sm text-gray-500">chars</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {bundlePreview?.metadata?.warnings && bundlePreview.metadata.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {bundlePreview.metadata.warnings.map((warning: string, index: number) => (
                <div key={index}>• {warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="assembly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="assembly">Assembly Order</TabsTrigger>
          <TabsTrigger value="bundle">Bundle Preview</TabsTrigger>
          <TabsTrigger value="json">Runtime JSON</TabsTrigger>
        </TabsList>

        {/* Assembly Order Tab */}
        <TabsContent value="assembly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Effective Ruleset Order</CardTitle>
              <CardDescription>
                The order in which rulesets will be applied for this entry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-2">Assembly Order</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">1</Badge>
                      <span>Core system rules</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">2</Badge>
                      <span>World: {bundlePreview?.world?.name || 'No world'}</span>
                    </div>
                    {bundlePreview?.rulesets && bundlePreview.rulesets.length > 0 && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">3</Badge>
                          <span>Entry-specific rulesets (in order):</span>
                        </div>
                        <div className="ml-6 space-y-1">
                          {bundlePreview.rulesets.map((ruleset: any, index: number) => (
                            <div key={ruleset.id} className="flex items-center space-x-2">
                              <Badge variant="secondary">{index + 1}</Badge>
                              <span>{ruleset.name}</span>
                              <Badge variant="outline">v{ruleset.version_semver}</Badge>
                              {ruleset.status === 'draft' && (
                                <Badge variant="secondary">Draft</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    onClick={handleCopyToClipboard}
                    variant="outline"
                    className="min-w-[120px]"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Order
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bundle Preview Tab */}
        <TabsContent value="bundle" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bundle Preview</CardTitle>
              <CardDescription>
                Overview of all entities and associations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bundlePreview && (
                <div className="space-y-6">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold">{bundlePreview.metadata.total_rulesets}</div>
                      <div className="text-sm text-gray-600">Rulesets</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold">{bundlePreview.metadata.total_npcs}</div>
                      <div className="text-sm text-gray-600">NPCs</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold">{bundlePreview.metadata.total_npc_packs}</div>
                      <div className="text-sm text-gray-600">NPC Packs</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold">{bundlePreview.metadata.total_members}</div>
                      <div className="text-sm text-gray-600">Total Members</div>
                    </div>
                  </div>

                  {/* Size Info */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Estimated Size</span>
                      <span className="font-mono text-lg">
                        {bundlePreview.metadata.estimated_size.toLocaleString()} chars
                      </span>
                    </div>
                    {bundlePreview.metadata.estimated_size > previewOptions.maxSize && (
                      <div className="mt-2 text-sm text-red-600">
                        ⚠️ Exceeds maximum size limit
                      </div>
                    )}
                  </div>

                  {/* Rulesets */}
                  {bundlePreview.rulesets.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">Rulesets</h3>
                      <div className="space-y-2">
                        {bundlePreview.rulesets.map((ruleset: any) => (
                          <div key={ruleset.id} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center space-x-2">
                              <span>{ruleset.name}</span>
                              <Badge variant="outline">v{ruleset.version_semver}</Badge>
                              {ruleset.status === 'draft' && (
                                <Badge variant="secondary">Draft</Badge>
                              )}
                            </div>
                            <span className="text-sm text-gray-500">Order: {ruleset.sort_order}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NPCs */}
                  {bundlePreview.npcs.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">NPCs</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {bundlePreview.npcs.map((npc: any) => (
                          <div key={npc.id} className="p-2 border rounded text-sm">
                            {npc.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NPC Packs */}
                  {bundlePreview.npc_packs.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">NPC Packs</h3>
                      <div className="space-y-2">
                        {bundlePreview.npc_packs.map((pack: any) => (
                          <div key={pack.id} className="p-2 border rounded">
                            <div className="font-medium">{pack.name}</div>
                            <div className="text-sm text-gray-600">
                              {pack.members.length} members
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Runtime JSON Tab */}
        <TabsContent value="json" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Runtime JSON</CardTitle>
              <CardDescription>
                The exact JSON structure that will be consumed by the runtime
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-end space-x-2">
                  <Button
                    onClick={handleCopyToClipboard}
                    variant="outline"
                    size="sm"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleDownloadJSON}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>

                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">
                    {bundlePreview ? JSON.stringify(bundlePreview, null, 2) : 'Loading...'}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}