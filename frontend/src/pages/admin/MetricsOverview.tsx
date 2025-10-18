// Phase 24: Metrics Overview Dashboard
// Real-time overview with SLO health, traffic, and trends

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface MetricsOverviewData {
  total_sessions: number;
  total_turns: number;
  avg_latency_p95: number;
  retry_rate: number;
  fallback_rate: number;
  stuck_rate: number;
  incidents_count: number;
  trends: {
    sessions: Array<{ date: string; value: number }>;
    latency: Array<{ date: string; value: number }>;
    retry_rate: Array<{ date: string; value: number }>;
  };
}

interface MetricsFilters {
  from: string;
  to: string;
  world?: string;
  adventure?: string;
  locale?: string;
  model?: string;
  experiment?: string;
  variation?: string;
  granularity: 'hour' | 'day';
}

export default function MetricsOverview() {
  const [data, setData] = useState<MetricsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MetricsFilters>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    granularity: 'day',
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
      
      const response = await fetch(`/api/metrics/overview?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch metrics');
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

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercentage = (num: number) => `${(num * 100).toFixed(2)}%`;

  const getHealthStatus = (rate: number, threshold: number) => {
    if (rate <= threshold * 0.5) return { status: 'excellent', color: 'green' };
    if (rate <= threshold) return { status: 'good', color: 'blue' };
    if (rate <= threshold * 1.5) return { status: 'warning', color: 'yellow' };
    return { status: 'critical', color: 'red' };
  };

  const retryHealth = getHealthStatus(data?.retry_rate || 0, 0.05);
  const fallbackHealth = getHealthStatus(data?.fallback_rate || 0, 0.02);
  const stuckHealth = getHealthStatus(data?.stuck_rate || 0, 0.1);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading metrics...</span>
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
          <h1 className="text-3xl font-bold">Metrics Overview</h1>
          <p className="text-muted-foreground">
            Real-time system health and performance metrics
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
              <label className="text-sm font-medium">Granularity</label>
              <select
                value={filters.granularity}
                onChange={(e) => setFilters({ ...filters, granularity: e.target.value as 'hour' | 'day' })}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                <option value="day">Daily</option>
                <option value="hour">Hourly</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SLO Health Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.total_sessions || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data?.total_turns || 0)} total turns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Latency</CardTitle>
            <Badge variant={data?.avg_latency_p95 && data.avg_latency_p95 > 2000 ? 'destructive' : 'secondary'}>
              {data?.avg_latency_p95 ? `${data.avg_latency_p95}ms` : 'N/A'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.avg_latency_p95 || 0}ms</div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retry Rate</CardTitle>
            <Badge variant={retryHealth.status === 'critical' ? 'destructive' : 'secondary'}>
              {formatPercentage(data?.retry_rate || 0)}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(data?.retry_rate || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {retryHealth.status} health
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidents</CardTitle>
            <Badge variant={data?.incidents_count && data.incidents_count > 0 ? 'destructive' : 'secondary'}>
              {data?.incidents_count || 0}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.incidents_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active alerts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Retry Rate Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {retryHealth.status === 'excellent' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {retryHealth.status === 'good' && <CheckCircle className="h-5 w-5 text-blue-500" />}
              {retryHealth.status === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              {retryHealth.status === 'critical' && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <span className="capitalize">{retryHealth.status}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Fallback Rate Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {fallbackHealth.status === 'excellent' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {fallbackHealth.status === 'good' && <CheckCircle className="h-5 w-5 text-blue-500" />}
              {fallbackHealth.status === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              {fallbackHealth.status === 'critical' && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <span className="capitalize">{fallbackHealth.status}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Stuck Rate Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {stuckHealth.status === 'excellent' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {stuckHealth.status === 'good' && <CheckCircle className="h-5 w-5 text-blue-500" />}
              {stuckHealth.status === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              {stuckHealth.status === 'critical' && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <span className="capitalize">{stuckHealth.status}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="latency">Latency</TabsTrigger>
          <TabsTrigger value="retry">Retry Rate</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Sessions Over Time</CardTitle>
              <CardDescription>Daily session count trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.trends.sessions || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="latency">
          <Card>
            <CardHeader>
              <CardTitle>P95 Latency Over Time</CardTitle>
              <CardDescription>Response time trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.trends.latency || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retry">
          <Card>
            <CardHeader>
              <CardTitle>Retry Rate Over Time</CardTitle>
              <CardDescription>Error rate trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.trends.retry_rate || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatPercentage(value as number), 'Retry Rate']} />
                  <Line type="monotone" dataKey="value" stroke="#ff7300" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last Refresh */}
      <div className="text-sm text-muted-foreground text-center">
        Last updated: {lastRefresh.toLocaleString()}
      </div>
    </div>
  );
}
