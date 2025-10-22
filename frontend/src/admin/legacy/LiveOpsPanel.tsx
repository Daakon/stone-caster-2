// Phase 28: LiveOps Remote Configuration System
// Admin dashboard panel for LiveOps management

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  BarChart3,
  Zap,
  Shield,
  Eye,
  Download
} from 'lucide-react';

interface LiveOpsConfig {
  config_id: string;
  name: string;
  scope: 'global' | 'world' | 'adventure' | 'experiment' | 'session';
  scope_ref: string;
  status: 'draft' | 'scheduled' | 'active' | 'archived';
  payload: Record<string, any>;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
  updated_at: string;
}

interface LiveOpsStatus {
  frozen: boolean;
  cache: {
    size: number;
    keys: string[];
    ttl: number;
  };
}

interface ImpactMetrics {
  turns: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  coverage: {
    quest_graph: number;
    dialogue: number;
    mechanics: number;
    economy: number;
    world_sim: number;
    mods: number;
  };
  oracles: {
    soft_locks: number;
    budget_violations: number;
    validator_retries: number;
    fallback_engagements: number;
    safety_violations: number;
    performance_violations: number;
    integrity_violations: number;
  };
  behavior: {
    avg_turns_to_completion: number;
    exploration_efficiency: number;
    dialogue_engagement_rate: number;
    economic_activity_rate: number;
    risk_taking_rate: number;
  };
}

export default function LiveOpsPanel() {
  const [configs, setConfigs] = useState<LiveOpsConfig[]>([]);
  const [status, setStatus] = useState<LiveOpsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<LiveOpsConfig | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetrics | null>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configsRes, statusRes] = await Promise.all([
        fetch('/api/awf-liveops/configs'),
        fetch('/api/awf-liveops/status')
      ]);

      if (!configsRes.ok || !statusRes.ok) {
        throw new Error('Failed to load data');
      }

      const configsData = await configsRes.json();
      const statusData = await statusRes.json();

      setConfigs(configsData.data || []);
      setStatus(statusData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateConfig = async (configId: string) => {
    try {
      const response = await fetch(`/api/awf-liveops/configs/${configId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate: true })
      });

      if (!response.ok) {
        throw new Error('Failed to activate config');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate config');
    }
  };

  const handleArchiveConfig = async (configId: string) => {
    try {
      const response = await fetch(`/api/awf-liveops/configs/${configId}/archive`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to archive config');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive config');
    }
  };

  const handleRollbackConfig = async (configId: string) => {
    try {
      const response = await fetch(`/api/awf-liveops/configs/${configId}/rollback`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to rollback config');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback config');
    }
  };

  const handlePreviewConfig = async (config: LiveOpsConfig) => {
    try {
      const response = await fetch('/api/awf-liveops/resolve/preview', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to preview config');
      }

      const data = await response.json();
      setPreviewData(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview config');
    }
  };

  const handleDryRun = async (config: LiveOpsConfig) => {
    try {
      const response = await fetch('/api/awf-liveops/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            session_id: 'preview-session',
            world_id: config.scope === 'world' ? config.scope_ref : undefined,
            adventure_id: config.scope === 'adventure' ? config.scope_ref : undefined,
            experiment_id: config.scope === 'experiment' ? config.scope_ref : undefined
          },
          proposed_config: config.payload
        })
      });

      if (!response.ok) {
        throw new Error('Failed to run dry-run');
      }

      const data = await response.json();
      setImpactMetrics(data.data.impact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run dry-run');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      scheduled: 'default',
      active: 'default',
      archived: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const getScopeIcon = (scope: string) => {
    const icons = {
      global: <Settings className="h-4 w-4" />,
      world: <Globe className="h-4 w-4" />,
      adventure: <Zap className="h-4 w-4" />,
      experiment: <BarChart3 className="h-4 w-4" />,
      session: <Play className="h-4 w-4" />
    };

    return icons[scope as keyof typeof icons] || <Settings className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LiveOps Panel</h1>
          <p className="text-muted-foreground">
            Real-time configuration management for game balance and pacing
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {status?.frozen && (
            <Alert className="border-red-200 bg-red-50">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                LiveOps is globally frozen
              </AlertDescription>
            </Alert>
          )}
          <Button onClick={loadData} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Configs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configs.filter(c => c.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cache Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.cache.size || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              TTL: {status?.cache.ttl || 0}ms
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {status?.frozen ? (
                <Badge variant="destructive">Frozen</Badge>
              ) : (
                <Badge variant="default">Operational</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="configs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configs">Configurations</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LiveOps Configurations</CardTitle>
              <CardDescription>
                Manage remote configuration settings for game balance and pacing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid From</TableHead>
                    <TableHead>Valid To</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.config_id}>
                      <TableCell className="font-medium">{config.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getScopeIcon(config.scope)}
                          <span>{config.scope}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(config.status)}</TableCell>
                      <TableCell>
                        {config.valid_from ? new Date(config.valid_from).toLocaleString() : 'Immediate'}
                      </TableCell>
                      <TableCell>
                        {config.valid_to ? new Date(config.valid_to).toLocaleString() : 'No expiry'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreviewConfig(config)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {config.status === 'draft' && (
                            <Button
                              size="sm"
                              onClick={() => handleActivateConfig(config.config_id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {config.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleArchiveConfig(config.config_id)}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRollbackConfig(config.config_id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Preview</CardTitle>
              <CardDescription>
                Preview effective configuration for a specific context
              </CardDescription>
            </CardHeader>
            <CardContent>
              {previewData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Session ID</Label>
                      <Input value="preview-session" readOnly />
                    </div>
                    <div>
                      <Label>World ID</Label>
                      <Input value="world.forest_glade" readOnly />
                    </div>
                  </div>
                  <div>
                    <Label>Resolved Configuration</Label>
                    <Textarea
                      value={JSON.stringify(previewData.config, null, 2)}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Select a configuration to preview
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Impact Analysis</CardTitle>
              <CardDescription>
                Analyze the impact of configuration changes on game performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {impactMetrics ? (
                <div className="space-y-6">
                  {/* Latency Metrics */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Latency Impact</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>P50 Latency</Label>
                        <div className="text-2xl font-bold">{impactMetrics.latency.p50}ms</div>
                      </div>
                      <div>
                        <Label>P95 Latency</Label>
                        <div className="text-2xl font-bold">{impactMetrics.latency.p95}ms</div>
                      </div>
                      <div>
                        <Label>P99 Latency</Label>
                        <div className="text-2xl font-bold">{impactMetrics.latency.p99}ms</div>
                      </div>
                    </div>
                  </div>

                  {/* Token Usage */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Token Usage</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Input Tokens</Label>
                        <div className="text-2xl font-bold">{impactMetrics.tokens.input}</div>
                      </div>
                      <div>
                        <Label>Output Tokens</Label>
                        <div className="text-2xl font-bold">{impactMetrics.tokens.output}</div>
                      </div>
                      <div>
                        <Label>Total Tokens</Label>
                        <div className="text-2xl font-bold">{impactMetrics.tokens.total}</div>
                      </div>
                    </div>
                  </div>

                  {/* Coverage Metrics */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Coverage Impact</h3>
                    <div className="space-y-2">
                      {Object.entries(impactMetrics.coverage).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="capitalize">{key.replace('_', ' ')}</Label>
                          <div className="flex items-center space-x-2">
                            <Progress value={value * 100} className="w-32" />
                            <span className="text-sm font-medium">{Math.round(value * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Oracle Metrics */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Oracle Failures</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(impactMetrics.oracles).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="capitalize">{key.replace('_', ' ')}</Label>
                          <Badge variant={value > 0 ? 'destructive' : 'default'}>
                            {value}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Run a dry-run analysis to see impact metrics
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration History</CardTitle>
              <CardDescription>
                View audit trail of configuration changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Configuration history will be displayed here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
