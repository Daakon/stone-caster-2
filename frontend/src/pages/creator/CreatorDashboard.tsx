// Phase 26: Creator Dashboard
// Main dashboard for creators to manage their packs and namespace

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  TrendingUp,
  Users,
  Star,
  Download,
  Plus,
  Settings,
  BarChart3
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface CreatorProfile {
  creator_id: string;
  display_name: string;
  email_hash: string;
  verified: boolean;
  terms_accepted_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface CreatorNamespace {
  namespace: string;
  creator_id: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

interface PackSummary {
  namespace: string;
  version: string;
  status: string;
  manifest: {
    name: string;
    description: string;
    author: string;
    awf_core_range: string;
    tags: string[];
  };
  created_at: string;
  updated_at: string;
  certified_at?: string;
  listed_at?: string;
}

interface PackMetrics {
  namespace: string;
  version: string;
  adoption_count: number;
  error_rate: number;
  violation_rate: number;
  avg_acts_per_turn: number;
  token_budget_usage: number;
  p95_latency_delta_ms: number;
  download_count: number;
  unique_users: number;
  retention_rate: number;
  satisfaction_score: number;
}

export default function CreatorDashboard() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [namespaces, setNamespaces] = useState<CreatorNamespace[]>([]);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [metrics, setMetrics] = useState<PackMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch creator profile
      const profileResponse = await fetch('/api/marketplace/creator/profile');
      if (!profileResponse.ok) throw new Error('Failed to fetch profile');
      const profileData = await profileResponse.json();
      setProfile(profileData.data);

      // Fetch namespaces
      const namespacesResponse = await fetch('/api/marketplace/creator/namespaces');
      if (!namespacesResponse.ok) throw new Error('Failed to fetch namespaces');
      const namespacesData = await namespacesResponse.json();
      setNamespaces(namespacesData.data || []);

      // Fetch packs
      const packsResponse = await fetch('/api/marketplace/my/packs');
      if (!packsResponse.ok) throw new Error('Failed to fetch packs');
      const packsData = await packsResponse.json();
      setPacks(packsData.data || []);

      // Fetch metrics for all packs
      const metricsPromises = packsData.data?.map(async (pack: PackSummary) => {
        const metricsResponse = await fetch(`/api/marketplace/pack/${pack.namespace}/${pack.version}/metrics`);
        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          return metricsData.data;
        }
        return null;
      }) || [];

      const metricsResults = await Promise.all(metricsPromises);
      setMetrics(metricsResults.filter(Boolean));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'listed': return 'text-green-500';
      case 'certified': return 'text-blue-500';
      case 'reviewing': return 'text-yellow-500';
      case 'submitted': return 'text-orange-500';
      case 'draft': return 'text-gray-500';
      case 'rejected': return 'text-red-500';
      case 'delisted': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'listed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'certified': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'reviewing': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'submitted': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'draft': return <Package className="h-4 w-4 text-gray-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'delisted': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading dashboard...</span>
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
          <h1 className="text-3xl font-bold">Creator Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {profile?.display_name || 'Creator'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Pack
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Packs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{packs.length}</div>
            <p className="text-xs text-muted-foreground">
              {packs.filter(p => p.status === 'listed').length} listed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics.reduce((sum, m) => sum + m.download_count, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all packs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics.reduce((sum, m) => sum + m.unique_users, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.length > 0 
                ? (metrics.reduce((sum, m) => sum + m.satisfaction_score, 0) / metrics.length).toFixed(1)
                : '0.0'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Satisfaction score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="packs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="packs">My Packs</TabsTrigger>
          <TabsTrigger value="namespaces">Namespaces</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="releases">New Release</TabsTrigger>
        </TabsList>

        <TabsContent value="packs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">My Packs</h2>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload New Pack
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packs.map((pack) => (
                <Card key={`${pack.namespace}-${pack.version}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pack.manifest.name}</CardTitle>
                      {getStatusIcon(pack.status)}
                    </div>
                    <CardDescription>
                      {pack.namespace}@{pack.version}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {pack.manifest.description}
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status</span>
                        <Badge variant="outline" className={getStatusColor(pack.status)}>
                          {pack.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">AWF Core</span>
                        <span className="text-sm text-muted-foreground">
                          {pack.manifest.awf_core_range}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Created</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(pack.created_at)}
                        </span>
                      </div>

                      {pack.tags && pack.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pack.manifest.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {pack.manifest.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{pack.manifest.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                      <Button variant="outline" size="sm" className="flex-1">
                        View Details
                      </Button>
                      {pack.status === 'draft' && (
                        <Button size="sm" className="flex-1">
                          Submit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="namespaces">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">My Namespaces</h2>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Claim Namespace
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {namespaces.map((namespace) => (
                <Card key={namespace.namespace}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{namespace.namespace}</CardTitle>
                      {namespace.verified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status</span>
                        <Badge variant={namespace.verified ? 'default' : 'secondary'}>
                          {namespace.verified ? 'Verified' : 'Pending'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Created</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(namespace.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Packs</span>
                        <span className="text-sm text-muted-foreground">
                          {packs.filter(p => p.namespace === namespace.namespace).length}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                      <Button variant="outline" size="sm" className="flex-1">
                        View Packs
                      </Button>
                      <Button size="sm" className="flex-1">
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Analytics</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Download Trends</CardTitle>
                  <CardDescription>Downloads over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics.map(m => ({
                        name: m.namespace,
                        downloads: m.download_count,
                        users: m.unique_users
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="downloads" stroke="#8884d8" />
                        <Line type="monotone" dataKey="users" stroke="#82ca9d" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Error Rate</span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.length > 0 
                          ? (metrics.reduce((sum, m) => sum + m.error_rate, 0) / metrics.length).toFixed(2)
                          : '0.00'
                        }%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Avg Acts/Turn</span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.length > 0 
                          ? (metrics.reduce((sum, m) => sum + m.avg_acts_per_turn, 0) / metrics.length).toFixed(2)
                          : '0.00'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Token Usage</span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.length > 0 
                          ? (metrics.reduce((sum, m) => sum + m.token_budget_usage, 0) / metrics.length).toFixed(2)
                          : '0.00'
                        }%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Satisfaction</span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.length > 0 
                          ? (metrics.reduce((sum, m) => sum + m.satisfaction_score, 0) / metrics.length).toFixed(2)
                          : '0.00'
                        }/10
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="releases">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">New Release</h2>
            <p className="text-muted-foreground">
              Upload a new pack or create a new version of an existing pack.
            </p>
            
            <Card>
              <CardHeader>
                <CardTitle>Upload Pack</CardTitle>
                <CardDescription>
                  Upload a ZIP file containing your mod pack
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Select Namespace
                    </label>
                    <select className="w-full p-2 border rounded-md">
                      <option value="">Choose a namespace</option>
                      {namespaces.map((namespace) => (
                        <option key={namespace.namespace} value={namespace.namespace}>
                          {namespace.namespace}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Version
                    </label>
                    <input 
                      type="text" 
                      placeholder="1.0.0" 
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Pack File
                    </label>
                    <input 
                      type="file" 
                      accept=".zip" 
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  
                  <Button className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Pack
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
