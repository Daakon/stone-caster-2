// Phase 26: Marketplace Review
// Admin interface for reviewing and certifying mod packs

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Eye,
  Download,
  Shield,
  FileText,
  BarChart3,
  Users,
  Star,
  TrendingUp
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PackReview {
  namespace: string;
  version: string;
  status: string;
  manifest: {
    name: string;
    description: string;
    author: string;
    awf_core_range: string;
    dependencies: Array<{
      namespace: string;
      version_range: string;
      type: string;
    }>;
    capabilities: Array<{
      hook_name: string;
      hook_type: string;
      description: string;
    }>;
    tags: string[];
    license: string;
  };
  sbom: {
    files: Array<{
      path: string;
      hash: string;
      size: number;
      type: string;
    }>;
    total_size: number;
  };
  hash: string;
  signature: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
}

interface LintResult {
  success: boolean;
  results: any;
  errors: string;
}

interface PlaytestResult {
  success: boolean;
  results: any;
  errors: string;
}

interface SecurityScanResult {
  success: boolean;
  issues: string[];
  scanned_files: number;
}

interface PackMetrics {
  adoption_count: number;
  error_rate: number;
  violation_rate: number;
  avg_acts_per_turn: number;
  token_budget_usage: number;
  p95_latency_delta_ms: number;
  download_count: number;
}

export default function MarketplaceReview() {
  const [pendingPacks, setPendingPacks] = useState<PackReview[]>([]);
  const [selectedPack, setSelectedPack] = useState<PackReview | null>(null);
  const [lintResults, setLintResults] = useState<LintResult | null>(null);
  const [playtestResults, setPlaytestResults] = useState<PlaytestResult | null>(null);
  const [securityResults, setSecurityResults] = useState<SecurityScanResult | null>(null);
  const [metrics, setMetrics] = useState<PackMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchPendingPacks();
  }, []);

  const fetchPendingPacks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/marketplace/admin/pending-packs');
      if (!response.ok) throw new Error('Failed to fetch pending packs');
      
      const result = await response.json();
      if (result.success) {
        setPendingPacks(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to fetch pending packs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPackDetails = async (pack: PackReview) => {
    try {
      setSelectedPack(pack);
      
      // Fetch lint results
      const lintResponse = await fetch(`/api/marketplace/pack/${pack.namespace}/${pack.version}/lint`);
      if (lintResponse.ok) {
        const lintData = await lintResponse.json();
        setLintResults(lintData.data);
      }

      // Fetch playtest results
      const playtestResponse = await fetch(`/api/marketplace/pack/${pack.namespace}/${pack.version}/playtest`);
      if (playtestResponse.ok) {
        const playtestData = await playtestResponse.json();
        setPlaytestResults(playtestData.data);
      }

      // Fetch security scan results
      const securityResponse = await fetch(`/api/marketplace/pack/${pack.namespace}/${pack.version}/security`);
      if (securityResponse.ok) {
        const securityData = await securityResponse.json();
        setSecurityResults(securityData.data);
      }

      // Fetch metrics
      const metricsResponse = await fetch(`/api/marketplace/pack/${pack.namespace}/${pack.version}/metrics`);
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data);
      }
    } catch (err) {
      console.error('Failed to fetch pack details:', err);
    }
  };

  const handleReviewAction = async (action: 'approve' | 'reject') => {
    if (!selectedPack) return;

    try {
      const response = await fetch(`/api/marketplace/pack/${selectedPack.namespace}/${selectedPack.version}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          review_notes: reviewNotes,
          reviewer_id: 'current-admin-id' // Would be from auth context
        })
      });

      if (!response.ok) throw new Error('Failed to submit review');

      const result = await response.json();
      if (result.success) {
        // Remove from pending list
        setPendingPacks(prev => prev.filter(p => 
          !(p.namespace === selectedPack.namespace && p.version === selectedPack.version)
        ));
        setSelectedPack(null);
        setReviewNotes('');
      } else {
        throw new Error(result.error || 'Review submission failed');
      }
    } catch (err) {
      console.error('Review action failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'text-orange-500';
      case 'reviewing': return 'text-yellow-500';
      case 'certified': return 'text-green-500';
      case 'rejected': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'reviewing': return <Eye className="h-4 w-4 text-yellow-500" />;
      case 'certified': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading review queue...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketplace Review</h1>
          <p className="text-muted-foreground">
            Review and certify mod packs for the marketplace
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            {pendingPacks.length} pending review
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Packs List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Pending Review</CardTitle>
              <CardDescription>
                Packs waiting for review and certification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingPacks.map((pack) => (
                  <div
                    key={`${pack.namespace}-${pack.version}`}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPack?.namespace === pack.namespace && selectedPack?.version === pack.version
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => fetchPackDetails(pack)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{pack.manifest.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {pack.namespace}@{pack.version}
                        </div>
                      </div>
                      {getStatusIcon(pack.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(pack.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pack Review Details */}
        <div className="lg:col-span-2">
          {selectedPack ? (
            <div className="space-y-4">
              {/* Pack Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedPack.manifest.name}</CardTitle>
                      <CardDescription>
                        {selectedPack.namespace}@{selectedPack.version} by {selectedPack.manifest.author}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(selectedPack.status)}
                      <Badge variant="outline" className={getStatusColor(selectedPack.status)}>
                        {selectedPack.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {selectedPack.manifest.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">AWF Core:</span> {selectedPack.manifest.awf_core_range}
                    </div>
                    <div>
                      <span className="font-medium">License:</span> {selectedPack.manifest.license}
                    </div>
                    <div>
                      <span className="font-medium">Size:</span> {formatFileSize(selectedPack.sbom.total_size)}
                    </div>
                    <div>
                      <span className="font-medium">Files:</span> {selectedPack.sbom.files.length}
                    </div>
                  </div>

                  {selectedPack.manifest.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-4">
                      {selectedPack.manifest.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Review Tabs */}
              <Tabs defaultValue="manifest" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="manifest">Manifest</TabsTrigger>
                  <TabsTrigger value="lint">Lint Results</TabsTrigger>
                  <TabsTrigger value="playtest">Playtest</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                  <TabsTrigger value="metrics">Metrics</TabsTrigger>
                </TabsList>

                <TabsContent value="manifest">
                  <Card>
                    <CardHeader>
                      <CardTitle>Manifest Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Dependencies</h4>
                          {selectedPack.manifest.dependencies.length > 0 ? (
                            <div className="space-y-2">
                              {selectedPack.manifest.dependencies.map((dep, index) => (
                                <div key={index} className="flex items-center justify-between p-2 border rounded">
                                  <span>{dep.namespace}@{dep.version_range}</span>
                                  <Badge variant="outline">{dep.type}</Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No dependencies</p>
                          )}
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Capabilities</h4>
                          {selectedPack.manifest.capabilities.length > 0 ? (
                            <div className="space-y-2">
                              {selectedPack.manifest.capabilities.map((cap, index) => (
                                <div key={index} className="p-2 border rounded">
                                  <div className="font-medium">{cap.hook_name}</div>
                                  <div className="text-sm text-muted-foreground">{cap.hook_type}</div>
                                  <div className="text-sm">{cap.description}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No capabilities declared</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="lint">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lint Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {lintResults ? (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            {lintResults.success ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-medium">
                              {lintResults.success ? 'Lint Passed' : 'Lint Failed'}
                            </span>
                          </div>
                          
                          {lintResults.results && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <pre className="text-sm overflow-auto">
                                {JSON.stringify(lintResults.results, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {lintResults.errors && (
                            <div className="bg-red-50 p-4 rounded-lg">
                              <pre className="text-sm text-red-600 overflow-auto">
                                {lintResults.errors}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading lint results...</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="playtest">
                  <Card>
                    <CardHeader>
                      <CardTitle>Playtest Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {playtestResults ? (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            {playtestResults.success ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-medium">
                              {playtestResults.success ? 'Playtest Passed' : 'Playtest Failed'}
                            </span>
                          </div>
                          
                          {playtestResults.results && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <pre className="text-sm overflow-auto">
                                {JSON.stringify(playtestResults.results, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {playtestResults.errors && (
                            <div className="bg-red-50 p-4 rounded-lg">
                              <pre className="text-sm text-red-600 overflow-auto">
                                {playtestResults.errors}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading playtest results...</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="security">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security Scan Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {securityResults ? (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            {securityResults.success ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-medium">
                              {securityResults.success ? 'Security Scan Passed' : 'Security Issues Found'}
                            </span>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            Scanned {securityResults.scanned_files} files
                          </div>
                          
                          {securityResults.issues.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-red-600">Security Issues:</h4>
                              {securityResults.issues.map((issue, index) => (
                                <div key={index} className="bg-red-50 p-3 rounded-lg">
                                  <div className="text-sm text-red-600">{issue}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading security scan results...</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="metrics">
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {metrics ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">Adoption Count</span>
                              <span className="text-sm text-muted-foreground">{metrics.adoption_count}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">Error Rate</span>
                              <span className="text-sm text-muted-foreground">{metrics.error_rate.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">Avg Acts/Turn</span>
                              <span className="text-sm text-muted-foreground">{metrics.avg_acts_per_turn.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">Token Usage</span>
                              <span className="text-sm text-muted-foreground">{metrics.token_budget_usage.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">Download Count</span>
                              <span className="text-sm text-muted-foreground">{metrics.download_count}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">Latency Delta</span>
                              <span className="text-sm text-muted-foreground">{metrics.p95_latency_delta_ms}ms</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading metrics...</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Review Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Review Decision</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Review Notes
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add notes about your review decision..."
                        className="w-full p-3 border rounded-md h-24 resize-none"
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => handleReviewAction('approve')}
                        className="flex-1"
                        disabled={!reviewNotes.trim()}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve & Certify
                      </Button>
                      <Button
                        onClick={() => handleReviewAction('reject')}
                        variant="destructive"
                        className="flex-1"
                        disabled={!reviewNotes.trim()}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a pack to review</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
