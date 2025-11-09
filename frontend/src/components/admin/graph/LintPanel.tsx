/**
 * Lint Panel Component
 * Display graph validation issues
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface LintIssue {
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeIndex?: number;
}

interface LintPanelProps {
  issues: LintIssue[];
}

export function LintPanel({ issues }: LintPanelProps) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (issues.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>Validation Passed</AlertTitle>
        <AlertDescription>No issues found</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant={errors.length > 0 ? 'destructive' : 'default'}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        Validation Issues ({errors.length} errors, {warnings.length} warnings)
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-2 mt-2">
          {errors.map((issue, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="destructive">Error</Badge>
              <span>{issue.message}</span>
              {issue.nodeId && <span className="text-xs text-muted-foreground">(Node: {issue.nodeId})</span>}
              {issue.edgeIndex !== undefined && <span className="text-xs text-muted-foreground">(Edge: {issue.edgeIndex})</span>}
            </div>
          ))}
          {warnings.map((issue, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="secondary">Warning</Badge>
              <span>{issue.message}</span>
              {issue.nodeId && <span className="text-xs text-muted-foreground">(Node: {issue.nodeId})</span>}
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}

