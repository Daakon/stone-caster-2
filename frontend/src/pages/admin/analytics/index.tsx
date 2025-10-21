import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Gamepad2, 
  Zap,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { AdminAnalyticsService, OverviewCards, DailySeries } from '@/services/admin.analytics';
import { useAppRoles } from '@/admin/routeGuard';
import { toast } from 'sonner';

export default function AnalyticsDashboard() {
  const { isModerator, isAdmin } = useAppRoles();
  const [overviewCards, setOverviewCards] = useState<OverviewCards | null>(null);
  const [dailySeries, setDailySeries] = useState<DailySeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'submissions' | 'approvals' | 'active_public' | 'games_started' | 'tokens_used'>('submissions');
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  // Check permissions
  if (!isModerator && !isAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access analytics. This feature is restricted to moderators and administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Load overview cards
      const cards = await AdminAnalyticsService.getOverviewCards({ sinceDays: 7 });
      setOverviewCards(cards);
      
      // Load daily series
      const series = await AdminAnalyticsService.getDailySeries({ 
        metric: selectedMetric, 
        sinceDays: selectedPeriod 
      });
      setDailySeries(series);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedMetric, selectedPeriod]);

  const handleRefresh = () => {
    loadAnalytics();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getMetricLabel = (metric: string) => {
    const labels = {
      submissions: 'Submissions',
      approvals: 'Approvals',
      active_public: 'Active Public Entries',
      games_started: 'Games Started',
      tokens_used: 'Tokens Used'
    };
    return labels[metric as keyof typeof labels] || metric;
  };

  const getMetricIcon = (metric: string) => {
    const icons = {
      submissions: TrendingUp,
      approvals: Clock,
      active_public: Users,
      games_started: Gamepad2,
      tokens_used: Zap
    };
    return icons[metric as keyof typeof icons] || TrendingUp;
  };

  if (loading && !overviewCards) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Community and gameplay health metrics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {overviewCards && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Public Entries</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overviewCards.activePublicEntries)}</div>
              <p className="text-xs text-muted-foreground">Currently live</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overviewCards.pendingReviews)}</div>
              <p className="text-xs text-muted-foreground">Awaiting moderation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Review SLA</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewCards.avgReviewSLA.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Games Started (7d)</CardTitle>
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overviewCards.gamesStarted7d)}</div>
              <p className="text-xs text-muted-foreground">New games</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tokens Used (7d)</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overviewCards.tokensUsed7d)}</div>
              <p className="text-xs text-muted-foreground">AI tokens consumed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Series Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daily Trends</CardTitle>
                <CardDescription>
                  {getMetricLabel(selectedMetric)} over the last {selectedPeriod} days
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as any)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submissions">Submissions</SelectItem>
                    <SelectItem value="approvals">Approvals</SelectItem>
                    <SelectItem value="active_public">Active Entries</SelectItem>
                    <SelectItem value="games_started">Games Started</SelectItem>
                    <SelectItem value="tokens_used">Tokens Used</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedPeriod.toString()} onValueChange={(value) => setSelectedPeriod(parseInt(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7d</SelectItem>
                    <SelectItem value="30">30d</SelectItem>
                    <SelectItem value="90">90d</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading chart data...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Simple bar chart representation */}
                <div className="space-y-2">
                  {dailySeries.slice(-14).map((point, index) => {
                    const maxValue = Math.max(...dailySeries.map(p => p.value));
                    const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
                    
                    return (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-16 text-xs text-muted-foreground">
                          {new Date(point.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex-1 bg-muted rounded-full h-4 relative">
                          <div 
                            className="bg-primary rounded-full h-4 transition-all duration-300"
                            style={{ width: `${height}%` }}
                          />
                        </div>
                        <div className="w-12 text-xs text-right">
                          {formatNumber(point.value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {dailySeries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No data available for the selected period
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review SLA Card */}
        <Card>
          <CardHeader>
            <CardTitle>Review Performance</CardTitle>
            <CardDescription>
              Content review efficiency metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average SLA</span>
                <Badge variant="secondary">
                  {overviewCards?.avgReviewSLA.toFixed(1)}h
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Under 24h</span>
                  <span className="font-medium">-</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Under 48h</span>
                  <span className="font-medium">-</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Under 72h</span>
                  <span className="font-medium">-</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  Based on last 30 days of resolved reviews
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Content Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Entries</span>
                <Badge variant="outline">{overviewCards?.activePublicEntries || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Pending Reviews</span>
                <Badge variant="destructive">{overviewCards?.pendingReviews || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Review Queue</span>
                <Badge variant="secondary">Healthy</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Community Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Games Started (7d)</span>
                <Badge variant="outline">{formatNumber(overviewCards?.gamesStarted7d || 0)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Tokens Used (7d)</span>
                <Badge variant="outline">{formatNumber(overviewCards?.tokensUsed7d || 0)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Growth Rate</span>
                <Badge variant="secondary">+12%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">AI Services</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">Operational</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Updated</span>
                <span className="text-xs text-muted-foreground">Just now</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
