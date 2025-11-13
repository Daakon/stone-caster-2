/**
 * Preflight Panel Component
 * Phase 6: Quality checks for creators before submission
 * Only visible when FF_PUBLISHING_PREFLIGHT and FF_PUBLISHING_QUALITY_GATES are enabled
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { isPublishingPreflightEnabled, isPublishingQualityGatesEnabled } from '@/lib/feature-flags';
import { apiFetch } from '@/lib/api';
import type { QualityIssue } from '@shared/types/publishing';
import { toast } from 'sonner';

interface PreflightPanelProps {
  type: 'world' | 'story' | 'npc';
  id: string;
}

export function PreflightPanel({ type, id }: PreflightPanelProps) {
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  if (!isPublishingPreflightEnabled() || !isPublishingQualityGatesEnabled()) {
    return null;
  }

  const runPreflight = async (persist: boolean = false) => {
    try {
      setLoading(true);
      const query = persist ? '?persist=true' : '';
      const response = await apiFetch<{
        score: number;
        issues: QualityIssue[];
      }>(`/api/publish/${type}/${id}/preflight${query}`);

      if (response.ok && response.data) {
        setScore(response.data.score);
        setIssues(response.data.issues);
        setLastRun(new Date());
        if (persist) {
          toast.success('Preflight check saved');
        }
      } else {
        toast.error(response.error?.message || 'Failed to run preflight');
      }
    } catch (error) {
      console.error('[publishing] Preflight error:', error);
      toast.error('Failed to run preflight');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getSeverityIcon = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getSeverityBadge = (severity: 'low' | 'medium' | 'high') => {
    const variantMap: Record<string, 'default' | 'secondary' | 'destructive'> = {
      high: 'destructive',
      medium: 'secondary',
      low: 'default',
    };
    return variantMap[severity] || 'default';
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Preflight Check</CardTitle>
            <CardDescription>
              Check for quality issues before submitting for review
            </CardDescription>
          </div>
          {lastRun && (
            <span className="text-xs text-muted-foreground">
              Last run: {lastRun.toLocaleTimeString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={() => runPreflight(false)}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Preflight
              </>
            )}
          </Button>
          <Button
            onClick={() => runPreflight(true)}
            disabled={loading}
            size="sm"
          >
            Run & Save
          </Button>
        </div>

        {score !== null && (
          <div className="space-y-4">
            {/* Score Display */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Quality Score</span>
                  <Badge variant={getScoreVariant(score)} className="text-lg font-bold">
                    {score}/100
                  </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getScoreColor(score)} bg-current`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Issues List */}
            {issues.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  No issues found! Your content is ready for review.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Issues Found ({issues.length})</h4>
                {issues.map((issue, index) => (
                  <Alert key={index} variant={issue.severity === 'high' ? 'destructive' : 'default'}>
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{issue.message}</span>
                          <Badge variant={getSeverityBadge(issue.severity)} size="sm">
                            {issue.severity}
                          </Badge>
                        </div>
                        {issue.path && (
                          <p className="text-xs text-muted-foreground mb-1">
                            Field: {issue.path}
                          </p>
                        )}
                        {issue.tip && (
                          <p className="text-sm text-muted-foreground">{issue.tip}</p>
                        )}
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}



