/**
 * Phase 20: Preview Panel
 * Shows bundle summary with tokens, slices, i18n, graph/sim/party/econ
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Eye, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Globe,
  Map,
  Users,
  Coins,
  Settings,
  FileText
} from 'lucide-react';

interface TokenBreakdown {
  world: number;
  adventure: number;
  graph: number;
  sim: number;
  party: number;
  economy: number;
  localization: number;
}

interface BundleSlices {
  world: boolean;
  adventure: boolean;
  graph: boolean;
  sim: boolean;
  party: boolean;
  economy: boolean;
  localization: boolean;
}

interface PreviewData {
  bundle: any;
  tokenEstimate: number;
  tokenBreakdown: TokenBreakdown;
  slices: BundleSlices;
  warnings: string[];
  errors: string[];
}

interface PreviewPanelProps {
  previewData: PreviewData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onRecordPlaytest: () => void;
  onVerifyPlaytest: () => void;
}

export function PreviewPanel({
  previewData,
  isLoading,
  onRefresh,
  onRecordPlaytest,
  onVerifyPlaytest,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const getSliceIcon = (slice: string) => {
    switch (slice) {
      case 'world': return <Globe className="w-4 h-4" />;
      case 'adventure': return <FileText className="w-4 h-4" />;
      case 'graph': return <Map className="w-4 h-4" />;
      case 'sim': return <Settings className="w-4 h-4" />;
      case 'party': return <Users className="w-4 h-4" />;
      case 'economy': return <Coins className="w-4 h-4" />;
      case 'localization': return <Globe className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getSliceColor = (slice: string, included: boolean) => {
    if (included) {
      return 'text-green-600 bg-green-50 border-green-200';
    }
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getTokenColor = (tokens: number, maxTokens: number) => {
    const percentage = (tokens / maxTokens) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
          <p className="text-gray-600">Assembling preview...</p>
        </div>
      </div>
    );
  }

  if (!previewData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">No preview data available</p>
          <Button onClick={onRefresh} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate Preview
          </Button>
        </div>
      </div>
    );
  }

  const { bundle, tokenEstimate, tokenBreakdown, slices, warnings, errors } = previewData;
  const maxTokens = 8000;
  const tokenPercentage = (tokenEstimate / maxTokens) * 100;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Preview</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={onRecordPlaytest}>
              Record Playtest
            </Button>
            <Button size="sm" variant="outline" onClick={onVerifyPlaytest}>
              Verify Playtest
            </Button>
          </div>
        </div>
        
        {/* Token Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Token Usage</span>
            <span className={`text-sm font-medium ${getTokenColor(tokenEstimate, maxTokens)}`}>
              {tokenEstimate.toLocaleString()} / {maxTokens.toLocaleString()}
            </span>
          </div>
          <Progress value={tokenPercentage} className="h-2" />
          <div className="text-xs text-gray-500">
            {tokenPercentage.toFixed(1)}% of token budget used
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="slices">Slices</TabsTrigger>
            <TabsTrigger value="bundle">Bundle</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="p-4">
            <div className="space-y-4">
              {/* Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {errors.length > 0 && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <AlertDescription className="text-red-700">
                        {errors.length} error{errors.length !== 1 ? 's' : ''} found
                      </AlertDescription>
                    </Alert>
                  )}
                  {warnings.length > 0 && (
                    <Alert className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <AlertDescription className="text-yellow-700">
                        {warnings.length} warning{warnings.length !== 1 ? 's' : ''} found
                      </AlertDescription>
                    </Alert>
                  )}
                  {errors.length === 0 && warnings.length === 0 && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <AlertDescription className="text-green-700">
                        Preview generated successfully
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              
              {/* Token Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Token Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(tokenBreakdown).map(([slice, tokens]) => (
                      <div key={slice} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getSliceIcon(slice)}
                          <span className="text-sm capitalize">{slice}</span>
                        </div>
                        <span className="text-sm font-medium">{tokens.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="slices" className="p-4">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Bundle Slices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(slices).map(([slice, included]) => (
                      <div
                        key={slice}
                        className={`p-3 rounded-lg border flex items-center gap-3 ${getSliceColor(slice, included)}`}
                      >
                        {getSliceIcon(slice)}
                        <div>
                          <div className="font-medium capitalize">{slice}</div>
                          <div className="text-xs opacity-75">
                            {included ? 'Included' : 'Not included'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="bundle" className="p-4">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Bundle Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
                    {JSON.stringify(bundle, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


