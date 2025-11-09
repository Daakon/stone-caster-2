/**
 * Module Detail Page
 * View module manifest and lint warnings
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, Package, Code, Info } from 'lucide-react';
import { api } from '@/lib/api';

interface Module {
  id: string;
  base_id: string;
  version: number;
  title: string;
  description?: string;
  state_slice: string;
  ai_hints: string[];
  exports: {
    capabilities: string[];
    actions: Array<{
      type: string;
      payload_schema: string;
    }>;
  };
  slots: string[];
  extras?: Record<string, unknown>;
  created_at: string;
}

interface LintWarning {
  severity: 'warning' | 'error';
  message: string;
}

export default function ModuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: module, isLoading, error } = useQuery({
    queryKey: ['admin', 'module', id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/modules/${id}`);
      if (!res.ok) throw new Error('Failed to fetch module');
      return res.data as Module;
    },
    enabled: !!id,
  });

  const { data: lintWarnings } = useQuery({
    queryKey: ['admin', 'modules', 'lint', id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/modules/lint?moduleId=${id}`);
      if (!res.ok) return [];
      return (res.data?.warnings || []) as LintWarning[];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">Loading module...</div>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-destructive">
          Failed to load module
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/modules')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{module.title}</h1>
          <p className="text-muted-foreground">{module.id}</p>
        </div>
      </div>

      {lintWarnings && lintWarnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">Lint Warnings</div>
            <ul className="list-disc list-inside space-y-1">
              {lintWarnings.map((warning, idx) => (
                <li key={idx}>{warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Base ID</div>
              <div className="font-mono">{module.base_id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Version</div>
              <Badge variant="outline">v{module.version}</Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">State Slice</div>
              <Badge variant="secondary">{module.state_slice}</Badge>
            </div>
            {module.description && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Description</div>
                <div>{module.description}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Created</div>
              <div>{new Date(module.created_at).toLocaleDateString()}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Hints</CardTitle>
          </CardHeader>
          <CardContent>
            {module.ai_hints.length === 0 ? (
              <div className="text-muted-foreground">No hints defined</div>
            ) : (
              <ul className="list-disc list-inside space-y-2">
                {module.ai_hints.map((hint, idx) => (
                  <li key={idx}>{hint}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capabilities</CardTitle>
          </CardHeader>
          <CardContent>
            {module.exports.capabilities.length === 0 ? (
              <div className="text-muted-foreground">No capabilities</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {module.exports.capabilities.map((cap, idx) => (
                  <Badge key={idx} variant="outline">{cap}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              {module.exports.actions.length} action{module.exports.actions.length !== 1 ? 's' : ''} exported
            </CardDescription>
          </CardHeader>
          <CardContent>
            {module.exports.actions.length === 0 ? (
              <div className="text-muted-foreground">No actions exported</div>
            ) : (
              <div className="space-y-3">
                {module.exports.actions.map((action, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="font-mono font-semibold">{action.type}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Schema: {action.payload_schema}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

