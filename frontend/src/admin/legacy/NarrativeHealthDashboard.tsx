// Phase 24: Narrative Health Dashboard
// Quest-node drop-offs, soft-lock hints, dialogue cooldown blocks

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, CheckCircle, Users, MessageSquare, Lock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Heatmap } from 'recharts';

interface NarrativeHealthData {
  quest_dropoffs: Array<{
    node_id: string;
    node_name: string;
    dropoff_rate: number;
    sessions: number;
  }>;
  softlock_hints: {
    total_hints: number;
    hint_coverage: number;
    avg_hint_delay: number;
  };
  dialogue_blocks: {
    cooldown_blocks: number;
    blocked_sessions: number;
    avg_block_duration: number;
  };
  dialogue_diversity: {
    total_dialogues: number;
    unique_dialogues: number;
    diversity_index: number;
  };
  trends: {
    dropoff_rates: Array<{ date: string; value: number }>;
    hint_usage: Array<{ date: string; value: number }>;
    dialogue_blocks: Array<{ date: string; value: number }>;
  };
}

interface NarrativeFilters {
  from: string;
  to: string;
  world?: string;
  adventure?: string;
  locale?: string;
  experiment?: string;
  variation?: string;
}

export default function NarrativeHealthDashboard() {
  const [data, setData] = useState<NarrativeHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<NarrativeFilters>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });
      
      const response = await fetch(`/api/metrics/narrative-health?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch narrative health data');
      
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch narrative health data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, filters]);

  const formatPercentage = (num: number) => `${(num * 100).toFixed(2)}%`;

  const getDropoffSeverity = (rate: number) => {
    if (rate <= 0.1) return { status: 'low', color: 'green' };
    if (rate <= 0.25) return { status: 'medium', color: 'yellow' };
    return { status: 'high', color: 'red' };
  };

  const getHintCoverageStatus = (coverage: number) => {
    if (coverage >= 0.8) return { status: 'excellent', color: 'green' };
    if (coverage >= 0.6) return { status: 'good', color: 'blue' };
    if (coverage >= 0.4) return { status: 'fair', color: 'yellow' };
    return { status: 'poor', color: 'red' };
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading narrative health data...</span>
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
          <h1 className="text-3xl font-bold">Narrative Health</h1>
          <p className="text-muted-foreground">
            Quest flow, dialogue quality, and player engagement metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Date From</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Date To</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium">World</label>
              <select
                value={filters.world || ''}
                onChange={(e) => setFilters({ ...filters, world: e.target.value || undefined })}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                <option value="">All Worlds</option>
                <option value="world.forest">Forest World</option>
                <option value="world.desert">Desert World</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quest Dropoffs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.quest_dropoffs.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Problematic nodes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hint Coverage</CardTitle>
            <Badge variant={getHintCoverageStatus(data?.softlock_hints.hint_coverage || 0).status === 'poor' ? 'destructive' : 'secondary'}>
              {formatPercentage(data?.softlock_hints.hint_coverage || 0)}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(data?.softlock_hints.hint_coverage || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {data?.softlock_hints.total_hints || 0} total hints
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dialogue Blocks</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.dialogue_blocks.cooldown_blocks || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.dialogue_blocks.blocked_sessions || 0} blocked sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dialogue Diversity</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(data?.dialogue_diversity.diversity_index || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {data?.dialogue_diversity.unique_dialogues || 0} unique dialogues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quest Dropoff Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Quest Dropoff Analysis</CardTitle>
          <CardDescription>Nodes with highest player dropoff rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.quest_dropoffs.slice(0, 10).map((dropoff, index) => {
              const severity = getDropoffSeverity(dropoff.dropoff_rate);
              return (
                <div key={dropoff.node_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{dropoff.node_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {dropoff.sessions} sessions
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={severity.status === 'high' ? 'destructive' : 'secondary'}>
                      {formatPercentage(dropoff.dropoff_rate)}
                    </Badge>
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          severity.status === 'high' ? 'bg-red-500' : 
                          severity.status === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(dropoff.dropoff_rate * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="dropoffs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dropoffs">Dropoff Rates</TabsTrigger>
          <TabsTrigger value="hints">Hint Usage</TabsTrigger>
          <TabsTrigger value="dialogue">Dialogue Blocks</TabsTrigger>
        </TabsList>

        <TabsContent value="dropoffs">
          <Card>
            <CardHeader>
              <CardTitle>Quest Dropoff Rates Over Time</CardTitle>
              <CardDescription>Average dropoff rate trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.trends.dropoff_rates || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatPercentage(value as number), 'Dropoff Rate']} />
                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hints">
          <Card>
            <CardHeader>
              <CardTitle>Soft-lock Hint Usage</CardTitle>
              <CardDescription>Hint usage trends and coverage</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.trends.hint_usage || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dialogue">
          <Card>
            <CardHeader>
              <CardTitle>Dialogue Cooldown Blocks</CardTitle>
              <CardDescription>Blocked dialogue interactions over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.trends.dialogue_blocks || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Health Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Hint Coverage Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getHintCoverageStatus(data?.softlock_hints.hint_coverage || 0).status === 'excellent' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {getHintCoverageStatus(data?.softlock_hints.hint_coverage || 0).status === 'good' && <CheckCircle className="h-5 w-5 text-blue-500" />}
              {getHintCoverageStatus(data?.softlock_hints.hint_coverage || 0).status === 'fair' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              {getHintCoverageStatus(data?.softlock_hints.hint_coverage || 0).status === 'poor' && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <span className="capitalize">
                {getHintCoverageStatus(data?.softlock_hints.hint_coverage || 0).status} coverage
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Average hint delay: {data?.softlock_hints.avg_hint_delay || 0} turns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Dialogue Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Diversity Index</span>
                <span className="text-sm font-medium">{formatPercentage(data?.dialogue_diversity.diversity_index || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Block Duration</span>
                <span className="text-sm font-medium">{data?.dialogue_blocks.avg_block_duration || 0} turns</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Refresh */}
      <div className="text-sm text-muted-foreground text-center">
        Last updated: {lastRefresh.toLocaleString()}
      </div>
    </div>
  );
}
