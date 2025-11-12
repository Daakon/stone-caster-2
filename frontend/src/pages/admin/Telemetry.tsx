/**
 * Telemetry Dashboard
 * Admin page for viewing turn processing metrics
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimeseriesChart } from '@/components/admin/metrics/TimeseriesChart';
import { TopList } from '@/components/admin/metrics/TopList';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TelemetrySummary {
  totalTurns: number;
  avgTokensAfter: number;
  avgLatencyMs: number;
  trimsRate: number;
  topTrimKeys: Array<{ key: string; count: number }>;
  rejectsByReason: Array<{ reason: string; count: number }>;
  // Phase 7 enhancements
  trimsRateBySlot: Array<{ slot: string; trimRate: number; count: number }>;
  p95TokensAfter: number;
  topCostlySlots: Array<{ slot: string; avgTokens: number }>;
}

interface TimeseriesPoint {
  t: string;
  value: number;
}

export default function Telemetry() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [storyId, setStoryId] = useState<string>('');

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery<TelemetrySummary>({
    queryKey: ['telemetry-summary', fromDate, toDate, storyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('from', fromDate);
      params.set('to', toDate);
      if (storyId) params.set('storyId', storyId);
      
      const res = await api.get(`/api/admin/telemetry/summary?${params.toString()}`);
      if (!res.ok) throw new Error(res.error.message || 'Failed to fetch summary');
      return res.data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch tokens timeseries
  const { data: tokensSeries } = useQuery<TimeseriesPoint[]>({
    queryKey: ['telemetry-timeseries', 'tokens_after', 'day', fromDate, toDate, storyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('metric', 'tokens_after');
      params.set('bucket', 'day');
      params.set('from', fromDate);
      params.set('to', toDate);
      if (storyId) params.set('storyId', storyId);
      
      const res = await api.get(`/api/admin/telemetry/timeseries?${params.toString()}`);
      if (!res.ok) throw new Error(res.error.message || 'Failed to fetch timeseries');
      return res.data;
    },
  });

  // Fetch latency timeseries
  const { data: latencySeries } = useQuery<TimeseriesPoint[]>({
    queryKey: ['telemetry-timeseries', 'latency_ms', 'day', fromDate, toDate, storyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('metric', 'latency_ms');
      params.set('bucket', 'day');
      params.set('from', fromDate);
      params.set('to', toDate);
      if (storyId) params.set('storyId', storyId);
      
      const res = await api.get(`/api/admin/telemetry/timeseries?${params.toString()}`);
      if (!res.ok) throw new Error(res.error.message || 'Failed to fetch timeseries');
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Telemetry Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor turn processing metrics, token usage, and performance
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="storyId">Story ID (optional)</Label>
              <Input
                id="storyId"
                placeholder="Filter by story"
                value={storyId}
                onChange={(e) => setStoryId(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Turns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? '...' : summary?.totalTurns || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Tokens After</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? '...' : summary?.avgTokensAfter || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? '...' : `${summary?.avgLatencyMs || 0}ms`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trims Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? '...' : `${summary?.trimsRate || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              % of turns with trims
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Tokens After</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? '...' : summary?.p95TokensAfter || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              95th percentile tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tokens After</CardTitle>
            <CardDescription>Average tokens after budget application</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeseriesChart data={tokensSeries || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latency</CardTitle>
            <CardDescription>Average model response time</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeseriesChart data={latencySeries || []} />
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Trimmed Sections</CardTitle>
            <CardDescription>Sections most frequently trimmed</CardDescription>
          </CardHeader>
          <CardContent>
            <TopList
              items={summary?.topTrimKeys || []}
              labelKey="key"
              valueKey="count"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rejected Acts by Reason</CardTitle>
            <CardDescription>Validation failures and rejections</CardDescription>
          </CardHeader>
          <CardContent>
            <TopList
              items={summary?.rejectsByReason || []}
              labelKey="reason"
              valueKey="count"
            />
          </CardContent>
        </Card>
      </div>

      {/* Phase 7: Enhanced Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Trims Rate by Slot</CardTitle>
            <CardDescription>Percentage of previews that trimmed each slot</CardDescription>
          </CardHeader>
          <CardContent>
            <TopList
              items={summary?.trimsRateBySlot || []}
              labelKey="slot"
              valueKey="trimRate"
              formatValue={(v) => `${v.toFixed(1)}%`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Costly Slots</CardTitle>
            <CardDescription>Slots with highest average token usage</CardDescription>
          </CardHeader>
          <CardContent>
            <TopList
              items={summary?.topCostlySlots || []}
              labelKey="slot"
              valueKey="avgTokens"
              formatValue={(v) => `${v} tokens`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

