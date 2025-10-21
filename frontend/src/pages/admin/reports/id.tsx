import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  User, 
  Calendar,
  FileText,
  Loader2
} from 'lucide-react';
import { AdminReportsService, type ContentReport } from '../../../services/admin.reports';
import { useAppRoles } from '@/admin/routeGuard';
import { toast } from 'sonner';

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isModerator, isAdmin } = useAppRoles();
  const [report, setReport] = useState<ContentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState('');

  // Check permissions
  if (!isModerator && !isAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access report details. This feature is restricted to moderators and administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  useEffect(() => {
    if (id) {
      loadReport();
    }
  }, [id]);

  const loadReport = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const reportData = await AdminReportsService.getReport(id);
      setReport(reportData);
    } catch (error) {
      console.error('Failed to load report:', error);
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!report || !id) return;

    try {
      setResolving(true);
      await AdminReportsService.resolveReport(id, {
        resolvedBy: 'current-user-id', // TODO: Get from auth
        note: resolveNote || undefined
      });
      
      toast.success('Report resolved successfully');
      navigate('/admin/reports');
    } catch (error) {
      console.error('Failed to resolve report:', error);
      toast.error('Failed to resolve report');
    } finally {
      setResolving(false);
    }
  };

  const getStateBadge = (report: ContentReport) => {
    if (report.resolved) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
    }
    return <Badge variant="destructive" className="bg-red-100 text-red-800"><Clock className="w-3 h-3 mr-1" />Open</Badge>;
  };

  const getTargetTypeBadge = (targetType: string) => {
    const colors = {
      entry_point: 'bg-blue-100 text-blue-800',
      prompt_segment: 'bg-purple-100 text-purple-800',
      npc: 'bg-green-100 text-green-800',
      turn: 'bg-orange-100 text-orange-800'
    };
    
    return (
      <Badge variant="outline" className={colors[targetType as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {targetType.replace('_', ' ')}
      </Badge>
    );
  };

  const maskContent = (content: string) => {
    // Simple PII masking for turn content
    return content
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
      .replace(/\b(https?:\/\/[^\s]+)\b/g, '[URL]')
      .substring(0, 500) + (content.length > 500 ? '...' : '');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading report...</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Report not found or you don't have permission to view it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/admin/reports')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Report Details</h1>
            <p className="text-muted-foreground">Review and resolve content report</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStateBadge(report)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Report Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Target Type</Label>
                  <div className="mt-1">
                    {getTargetTypeBadge(report.target_type)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Target ID</Label>
                  <div className="mt-1 font-mono text-sm">{report.target_id}</div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Reason</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">
                  {report.reason}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Reporter</Label>
                  <div className="mt-1 flex items-center">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="font-mono text-sm">{report.reporter_id}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <div className="mt-1 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span>{new Date(report.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Target Preview</CardTitle>
              <CardDescription>
                Preview of the reported content (PII masked for privacy)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-md">
                <pre className="whitespace-pre-wrap text-sm">
                  {maskContent(`Sample content for ${report.target_type} ${report.target_id}. This would be the actual content that was reported.`)}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Resolution Notes */}
          {report.notes && report.notes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resolution History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.notes.map((note: any, index: number) => (
                    <div key={index} className="p-3 bg-muted rounded-md">
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                        <span>By {note.by}</span>
                        <span>{new Date(note.at).toLocaleString()}</span>
                      </div>
                      <p>{note.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          {!report.resolved && (
            <Card>
              <CardHeader>
                <CardTitle>Resolve Report</CardTitle>
                <CardDescription>
                  Mark this report as resolved with an optional note
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="resolve-note">Resolution Note</Label>
                  <Textarea
                    id="resolve-note"
                    placeholder="Add a note about the resolution..."
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button 
                  onClick={handleResolve} 
                  disabled={resolving}
                  className="w-full"
                >
                  {resolving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Resolve Report
                </Button>
              </CardContent>
            </Card>
          )}

          {report.resolved && (
            <Card>
              <CardHeader>
                <CardTitle>Resolution Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Resolved By</Label>
                  <div className="mt-1 font-mono text-sm">{report.resolved_by}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Resolved At</Label>
                  <div className="mt-1">{new Date(report.resolved_at!).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="w-4 h-4 mr-2" />
                View Target
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <User className="w-4 h-4 mr-2" />
                Contact Reporter
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
