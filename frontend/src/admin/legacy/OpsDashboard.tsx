// Phase 25: Operations Dashboard
// Live ops dashboard with error budgets, SLOs, budget burn, and module toggles

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, CheckCircle, DollarSign, Settings, Activity, Shield } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface OpsStatusData {
  rate_limits: {
    total_limits: number;
    by_scope: Record<string, number>;
    top_limited: Array<{
      scope: string;
      key: string;
      current_count: number;
      max_requests: number;
    }>;
  };
  quotas: {
    total_quotas: number;
    by_type: {
      turns: { total_cap: number; total_used: number; avg_usage: number };
      tools: { total_cap: number; total_used: number; avg_usage: number };
      bytes: { total_cap: number; total_used: number; avg_usage: number };
    };
    top_users: Array<{
      user_hash: string;
      session_id: string;
      turns_usage: number;
      tools_usage: number;
      bytes_usage: number;
    }>;
  };
  backpressure: {
    active_metrics: number;
    total_actions: number;
  };
  circuit_breakers: {
    total_circuits: number;
    by_state: Record<string, number>;
    top_failures: Array<{
      service_name: string;
      failure_count: number;
      last_failure: string;
    }>;
  };
  budget: {
    current_month: string;
    budget_usd: number;
    spent_usd: number;
    remaining_usd: number;
    spend_ratio: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  incidents: {
    total: number;
    by_severity: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
}

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    response_time_ms: number;
    last_checked: string;
    error_message?: string;
  }>;
}

export default function OpsDashboard() {
  const [opsData, setOpsData] = useState<OpsStatusData | null>(null);
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchOpsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/ops/status');
      if (!response.ok) throw new Error('Failed to fetch ops status');
      
      const result = await response.json();
      if (result.success) {
        setOpsData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch ops status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/ops/health');
      if (!response.ok) throw new Error('Failed to fetch health status');
      
      const result = await response.json();
      if (result.success) {
        setHealthData(result.data);
      }
    } catch (err) {
    }
  };

  useEffect(() => {
    fetchOpsData();
    fetchHealthData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchOpsData();
      fetchHealthData();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      case 'degraded': return 'text-yellow-500';
      case 'unhealthy': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading && !opsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading operations data...</span>
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
          <h1 className="text-3xl font-bold">Operations Dashboard</h1>
          <p className="text-muted-foreground">
            Live system health, budget monitoring, and operational controls
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchOpsData(); fetchHealthData(); }}
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

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            {healthData && getStatusIcon(healthData.overall)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {healthData?.overall || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(healthData?.services || {}).length} services monitored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Status</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {opsData ? formatPercentage(opsData.budget.spend_ratio) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {opsData ? formatCurrency(opsData.budget.remaining_usd) : 'N/A'} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {opsData?.incidents.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {opsData?.incidents.by_severity.critical || 0} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Circuit Breakers</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {opsData?.circuit_breakers.total_circuits || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {opsData?.circuit_breakers.by_state.open || 0} open
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Status Cards */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Budget Overview</CardTitle>
                <CardDescription>Current month spending and projections</CardDescription>
              </CardHeader>
              <CardContent>
                {opsData && (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm">Budget</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(opsData.budget.budget_usd)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Spent</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(opsData.budget.spent_usd)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Remaining</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(opsData.budget.remaining_usd)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          opsData.budget.status === 'critical' ? 'bg-red-500' : 
                          opsData.budget.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(opsData.budget.spend_ratio * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Incident Summary</CardTitle>
                <CardDescription>Active incidents by severity</CardDescription>
              </CardHeader>
              <CardContent>
                {opsData && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Critical</span>
                      <Badge variant="destructive">
                        {opsData.incidents.by_severity.critical}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">High</span>
                      <Badge variant="destructive">
                        {opsData.incidents.by_severity.high}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Medium</span>
                      <Badge variant="secondary">
                        {opsData.incidents.by_severity.medium}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Low</span>
                      <Badge variant="outline">
                        {opsData.incidents.by_severity.low}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rate-limits">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Status</CardTitle>
              <CardDescription>Current rate limiting across different scopes</CardDescription>
            </CardHeader>
            <CardContent>
              {opsData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(opsData.rate_limits.by_scope).map(([scope, count]) => (
                      <div key={scope} className="text-center">
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-sm text-muted-foreground capitalize">{scope}</div>
                      </div>
                    ))}
                  </div>
                  
                  {opsData.rate_limits.top_limited.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Top Limited Keys</h4>
                      <div className="space-y-2">
                        {opsData.rate_limits.top_limited.slice(0, 5).map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <div className="font-medium">{item.key}</div>
                              <div className="text-sm text-muted-foreground">{item.scope}</div>
                            </div>
                            <Badge variant="destructive">
                              {item.current_count}/{item.max_requests}
                            </Badge>
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

        <TabsContent value="quotas">
          <Card>
            <CardHeader>
              <CardTitle>Quota Usage</CardTitle>
              <CardDescription>Current quota consumption across features</CardDescription>
            </CardHeader>
            <CardContent>
              {opsData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{opsData.quotas.by_type.turns.avg_usage.toFixed(1)}</div>
                      <div className="text-sm text-muted-foreground">Avg Turns Usage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{opsData.quotas.by_type.tools.avg_usage.toFixed(1)}</div>
                      <div className="text-sm text-muted-foreground">Avg Tools Usage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{opsData.quotas.by_type.bytes.avg_usage.toFixed(1)}</div>
                      <div className="text-sm text-muted-foreground">Avg Bytes Usage</div>
                    </div>
                  </div>
                  
                  {opsData.quotas.top_users.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Top Users by Usage</h4>
                      <div className="space-y-2">
                        {opsData.quotas.top_users.slice(0, 5).map((user, index) => (
                          <div key={index} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <div className="font-medium">
                                {user.user_hash || user.session_id || 'Unknown'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.turns_usage} turns, {user.tools_usage} tools
                              </div>
                            </div>
                            <Badge variant="outline">
                              {user.bytes_usage} bytes
                            </Badge>
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

        <TabsContent value="budget">
          <Card>
            <CardHeader>
              <CardTitle>Budget Analysis</CardTitle>
              <CardDescription>Spending trends and projections</CardDescription>
            </CardHeader>
            <CardContent>
              {opsData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Current Status</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Month</span>
                          <span className="text-sm font-medium">{opsData.budget.current_month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Budget</span>
                          <span className="text-sm font-medium">
                            {formatCurrency(opsData.budget.budget_usd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Spent</span>
                          <span className="text-sm font-medium">
                            {formatCurrency(opsData.budget.spent_usd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Remaining</span>
                          <span className="text-sm font-medium">
                            {formatCurrency(opsData.budget.remaining_usd)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Status</h4>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(opsData.budget.status)}
                        <span className="capitalize">{opsData.budget.status}</span>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-muted rounded-full h-4">
                          <div 
                            className={`h-4 rounded-full ${
                              opsData.budget.status === 'critical' ? 'bg-red-500' : 
                              opsData.budget.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(opsData.budget.spend_ratio * 100, 100)}%` }}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatPercentage(opsData.budget.spend_ratio)} of budget used
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>Individual service health status</CardDescription>
            </CardHeader>
            <CardContent>
              {healthData && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    {getStatusIcon(healthData.overall)}
                    <span className="text-lg font-medium capitalize">
                      Overall: {healthData.overall}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(healthData.services).map(([service, status]) => (
                      <div key={service} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium capitalize">{service}</h4>
                          {getStatusIcon(status.status)}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>Status: {status.status}</div>
                          <div>Response Time: {status.response_time_ms}ms</div>
                          <div>Last Checked: {new Date(status.last_checked).toLocaleString()}</div>
                          {status.error_message && (
                            <div className="text-red-500">Error: {status.error_message}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
