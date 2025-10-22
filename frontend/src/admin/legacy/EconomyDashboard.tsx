// Phase 24: Economy Dashboard
// Currency flow, vendor margins, crafting success rates

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Hammer } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface EconomyData {
  currency_flow: {
    total_inflow: number;
    total_outflow: number;
    net_flow: number;
    avg_per_session: number;
  };
  vendor_metrics: {
    total_trades: number;
    total_value: number;
    avg_margin: number;
    margin_rate: number;
  };
  crafting_metrics: {
    total_attempts: number;
    successful_attempts: number;
    success_rate: number;
    avg_difficulty: number;
  };
  item_distribution: Array<{
    rarity: string;
    count: number;
    percentage: number;
  }>;
  trends: {
    currency_flow: Array<{ date: string; inflow: number; outflow: number; net: number }>;
    vendor_trades: Array<{ date: string; value: number }>;
    crafting_success: Array<{ date: string; value: number }>;
  };
}

interface EconomyFilters {
  from: string;
  to: string;
  world?: string;
  adventure?: string;
  locale?: string;
  experiment?: string;
  variation?: string;
}

const RARITY_COLORS = {
  common: '#6b7280',
  uncommon: '#10b981',
  rare: '#3b82f6',
  epic: '#8b5cf6',
  legendary: '#f59e0b',
};

export default function EconomyDashboard() {
  const [data, setData] = useState<EconomyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EconomyFilters>({
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
      
      const response = await fetch(`/api/metrics/economy?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch economy data');
      
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch economy data');
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

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatPercentage = (num: number) => `${(num * 100).toFixed(2)}%`;

  const getFlowStatus = (net: number) => {
    if (net > 0) return { status: 'positive', color: 'green', icon: TrendingUp };
    if (net < 0) return { status: 'negative', color: 'red', icon: TrendingDown };
    return { status: 'neutral', color: 'gray', icon: TrendingUp };
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading economy data...</span>
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

  const flowStatus = getFlowStatus(data?.currency_flow.net_flow || 0);
  const FlowIcon = flowStatus.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Economy Dashboard</h1>
          <p className="text-muted-foreground">
            Currency flow, vendor margins, and crafting success metrics
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
            <CardTitle className="text-sm font-medium">Net Currency Flow</CardTitle>
            <FlowIcon className={`h-4 w-4 ${flowStatus.color === 'green' ? 'text-green-500' : flowStatus.color === 'red' ? 'text-red-500' : 'text-gray-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.currency_flow.net_flow || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(data?.currency_flow.avg_per_session || 0)} per session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendor Trades</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.vendor_metrics.total_trades || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(data?.vendor_metrics.total_value || 0)} total value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crafting Success</CardTitle>
            <Hammer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(data?.crafting_metrics.success_rate || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data?.crafting_metrics.successful_attempts || 0)} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendor Margin</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(data?.vendor_metrics.margin_rate || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(data?.vendor_metrics.avg_margin || 0)} avg margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Currency Flow Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Currency Inflow</CardTitle>
            <CardDescription>Gold earned by players</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(data?.currency_flow.total_inflow || 0)}
            </div>
            <p className="text-sm text-muted-foreground">
              Average per session: {formatCurrency(data?.currency_flow.avg_per_session || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Currency Outflow</CardTitle>
            <CardDescription>Gold spent by players</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(data?.currency_flow.total_outflow || 0)}
            </div>
            <p className="text-sm text-muted-foreground">
              Net flow: {formatCurrency(data?.currency_flow.net_flow || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="currency" className="space-y-4">
        <TabsList>
          <TabsTrigger value="currency">Currency Flow</TabsTrigger>
          <TabsTrigger value="vendor">Vendor Trades</TabsTrigger>
          <TabsTrigger value="crafting">Crafting Success</TabsTrigger>
          <TabsTrigger value="items">Item Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="currency">
          <Card>
            <CardHeader>
              <CardTitle>Currency Flow Over Time</CardTitle>
              <CardDescription>Daily currency inflow and outflow trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.trends.currency_flow || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [formatCurrency(value as number), name === 'inflow' ? 'Inflow' : name === 'outflow' ? 'Outflow' : 'Net']} />
                  <Line type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={2} name="inflow" />
                  <Line type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={2} name="outflow" />
                  <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} name="net" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendor">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Trade Value</CardTitle>
              <CardDescription>Daily vendor trade value trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.trends.vendor_trades || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Trade Value']} />
                  <Bar dataKey="value" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crafting">
          <Card>
            <CardHeader>
              <CardTitle>Crafting Success Rate</CardTitle>
              <CardDescription>Daily crafting success rate trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.trends.crafting_success || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatPercentage(value as number), 'Success Rate']} />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>Item Rarity Distribution</CardTitle>
              <CardDescription>Distribution of items by rarity</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data?.item_distribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ rarity, percentage }) => `${rarity} (${percentage.toFixed(1)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {data?.item_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={RARITY_COLORS[entry.rarity as keyof typeof RARITY_COLORS] || '#8884d8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Economy Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Economy Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Inflow vs Outflow Ratio</span>
                <span className="text-sm font-medium">
                  {data?.currency_flow.total_outflow ? 
                    (data.currency_flow.total_inflow / data.currency_flow.total_outflow).toFixed(2) : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Average Session Value</span>
                <span className="text-sm font-medium">{formatCurrency(data?.currency_flow.avg_per_session || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Crafting Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Success Rate</span>
                <span className="text-sm font-medium">{formatPercentage(data?.crafting_metrics.success_rate || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Average Difficulty</span>
                <span className="text-sm font-medium">{data?.crafting_metrics.avg_difficulty?.toFixed(1) || 0}</span>
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
