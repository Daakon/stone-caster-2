// Phase 24: Experiments Dashboard
// Variation comparison, KPI deltas, significance analysis

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, TrendingUp, TrendingDown, CheckCircle, XCircle, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ExperimentData {
  experiment: string;
  total_sessions: number;
  date_range: {
    from: string;
    to: string;
  };
  variations: Array<{
    variation: string;
    sessions: number;
    completion_rate: number;
    avg_latency: number;
    retry_rate: number;
    fallback_rate: number;
    stuck_rate: number;
    economy_velocity: number;
    craft_success_rate: number;
    vendor_trade_rate: number;
    party_recruits_rate: number;
    dialogue_diversity: number;
    romance_consent_rate: number;
    event_trigger_rate: number;
    significance: {
      completion_rate: boolean;
      latency: boolean;
      retry_rate: boolean;
      fallback_rate: boolean;
      stuck_rate: boolean;
      economy_velocity: boolean;
      craft_success_rate: boolean;
      vendor_trade_rate: boolean;
      party_recruits_rate: boolean;
      dialogue_diversity: boolean;
      romance_consent_rate: boolean;
      event_trigger_rate: boolean;
    };
    p_values: {
      completion_rate: number;
      latency: number;
      retry_rate: number;
      fallback_rate: number;
      stuck_rate: number;
      economy_velocity: number;
      craft_success_rate: number;
      vendor_trade_rate: number;
      party_recruits_rate: number;
      dialogue_diversity: number;
      romance_consent_rate: number;
      event_trigger_rate: number;
    };
  }>;
  overall_stats: {
    avg_completion_rate: number;
    avg_latency: number;
    avg_retry_rate: number;
    avg_fallback_rate: number;
    avg_stuck_rate: number;
  };
  significance_summary: {
    significant_metrics: string[];
    most_impactful_variation: string;
    recommended_action: string;
  };
}

interface ExperimentFilters {
  experiment: string;
  from: string;
  to: string;
  include_significance: boolean;
  confidence_level: number;
}

export default function ExperimentsDashboard() {
  const [data, setData] = useState<ExperimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExperimentFilters>({
    experiment: '',
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    include_significance: true,
    confidence_level: 0.95,
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!filters.experiment) {
        setError('Please select an experiment');
        setLoading(false);
        return;
      }
      
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });
      
      const response = await fetch(`/api/metrics/experiment?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch experiment data');
      
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch experiment data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filters.experiment) {
      fetchData();
    }
  }, [filters]);

  useEffect(() => {
    if (!autoRefresh || !filters.experiment) return;
    
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, filters]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercentage = (num: number) => `${(num * 100).toFixed(2)}%`;

  const formatPValue = (p: number) => {
    if (p < 0.001) return '< 0.001';
    return p.toFixed(3);
  };

  const getSignificanceBadge = (isSignificant: boolean, pValue: number) => {
    if (isSignificant) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Significant (p={formatPValue(pValue)})
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <XCircle className="h-3 w-3 mr-1" />
        Not Significant (p={formatPValue(pValue)})
      </Badge>
    );
  };

  const exportCSV = async () => {
    if (!data) return;
    
    try {
      const response = await fetch(`/api/metrics/experiment/export?experiment=${filters.experiment}&format=csv`);
      if (!response.ok) throw new Error('Failed to export data');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment_${filters.experiment}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading experiment data...</span>
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
          <h1 className="text-3xl font-bold">Experiments Dashboard</h1>
          <p className="text-muted-foreground">
            A/B test analysis with statistical significance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading || !filters.experiment}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            disabled={!filters.experiment}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!data}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Experiment</label>
              <select
                value={filters.experiment}
                onChange={(e) => setFilters({ ...filters, experiment: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                <option value="">Select Experiment</option>
                <option value="dialogue_improvements">Dialogue Improvements</option>
                <option value="economy_balance">Economy Balance</option>
                <option value="narrative_flow">Narrative Flow</option>
                <option value="party_mechanics">Party Mechanics</option>
              </select>
            </div>
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
              <label className="text-sm font-medium">Confidence Level</label>
              <select
                value={filters.confidence_level}
                onChange={(e) => setFilters({ ...filters, confidence_level: parseFloat(e.target.value) })}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                <option value={0.90}>90%</option>
                <option value={0.95}>95%</option>
                <option value={0.99}>99%</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Experiment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data.total_sessions)}</div>
                <p className="text-xs text-muted-foreground">
                  {data.date_range.from} to {data.date_range.to}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Variations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.variations.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active variations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Significant Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.significance_summary.significant_metrics.length}</div>
                <p className="text-xs text-muted-foreground">
                  Out of 12 tracked metrics
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Significance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Significance Summary</CardTitle>
              <CardDescription>Key findings and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Significant Metrics</h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.significance_summary.significant_metrics.map((metric) => (
                      <Badge key={metric} variant="default" className="bg-green-100 text-green-800">
                        {metric.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {data.significance_summary.most_impactful_variation && (
                  <div>
                    <h4 className="font-medium">Most Impactful Variation</h4>
                    <p className="text-sm text-muted-foreground">
                      {data.significance_summary.most_impactful_variation}
                    </p>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium">Recommended Action</h4>
                  <p className="text-sm text-muted-foreground">
                    {data.significance_summary.recommended_action}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variation Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Variation Comparison</CardTitle>
              <CardDescription>Detailed metrics for each variation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {data.variations.map((variation, index) => (
                  <div key={variation.variation} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">{variation.variation}</h3>
                      <Badge variant="outline">{formatNumber(variation.sessions)} sessions</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Completion Rate</div>
                        <div className="text-lg font-medium">{formatPercentage(variation.completion_rate)}</div>
                        {getSignificanceBadge(variation.significance.completion_rate, variation.p_values.completion_rate)}
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Latency</div>
                        <div className="text-lg font-medium">{variation.avg_latency}ms</div>
                        {getSignificanceBadge(variation.significance.latency, variation.p_values.latency)}
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground">Retry Rate</div>
                        <div className="text-lg font-medium">{formatPercentage(variation.retry_rate)}</div>
                        {getSignificanceBadge(variation.significance.retry_rate, variation.p_values.retry_rate)}
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground">Stuck Rate</div>
                        <div className="text-lg font-medium">{formatPercentage(variation.stuck_rate)}</div>
                        {getSignificanceBadge(variation.significance.stuck_rate, variation.p_values.stuck_rate)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <Tabs defaultValue="completion" className="space-y-4">
            <TabsList>
              <TabsTrigger value="completion">Completion Rate</TabsTrigger>
              <TabsTrigger value="latency">Latency</TabsTrigger>
              <TabsTrigger value="retry">Retry Rate</TabsTrigger>
              <TabsTrigger value="economy">Economy</TabsTrigger>
            </TabsList>

            <TabsContent value="completion">
              <Card>
                <CardHeader>
                  <CardTitle>Completion Rate by Variation</CardTitle>
                  <CardDescription>Comparison of completion rates across variations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.variations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="variation" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatPercentage(value as number), 'Completion Rate']} />
                      <Bar dataKey="completion_rate" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="latency">
              <Card>
                <CardHeader>
                  <CardTitle>Average Latency by Variation</CardTitle>
                  <CardDescription>Response time comparison across variations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.variations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="variation" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value}ms`, 'Latency']} />
                      <Bar dataKey="avg_latency" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retry">
              <Card>
                <CardHeader>
                  <CardTitle>Retry Rate by Variation</CardTitle>
                  <CardDescription>Error rate comparison across variations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.variations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="variation" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatPercentage(value as number), 'Retry Rate']} />
                      <Bar dataKey="retry_rate" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="economy">
              <Card>
                <CardHeader>
                  <CardTitle>Economy Velocity by Variation</CardTitle>
                  <CardDescription>Economic activity comparison across variations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.variations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="variation" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value}`, 'Economy Velocity']} />
                      <Bar dataKey="economy_velocity" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Last Refresh */}
      <div className="text-sm text-muted-foreground text-center">
        Last updated: {lastRefresh.toLocaleString()}
      </div>
    </div>
  );
}
