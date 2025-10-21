import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Filter, 
  Search, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  CheckSquare,
  X,
  Loader2
} from 'lucide-react';
import { AdminReportsService, type ContentReport, type ReportFilters } from '../../../services/admin.reports';
import { useAppRoles } from '@/admin/routeGuard';
import { toast } from 'sonner';

export default function ReportsQueue() {
  const { isModerator, isAdmin } = useAppRoles();
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [bulkResolveOpen, setBulkResolveOpen] = useState(false);
  const [bulkResolveNote, setBulkResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<ReportFilters>({
    state: 'open',
    since: 7,
    limit: 20
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Check permissions
  if (!isModerator && !isAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access the reports queue. This feature is restricted to moderators and administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await AdminReportsService.listReports({
        ...filters,
        q: searchQuery || undefined
      });
      setReports(response.reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [filters, searchQuery]);

  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSelectReport = (reportId: string, selected: boolean) => {
    if (selected) {
      setSelectedReports(prev => [...prev, reportId]);
    } else {
      setSelectedReports(prev => prev.filter(id => id !== reportId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedReports(reports.map(r => r.id));
    } else {
      setSelectedReports([]);
    }
  };

  const handleBulkResolve = async () => {
    if (selectedReports.length === 0) return;

    try {
      setResolving(true);
      await AdminReportsService.bulkResolve({
        ids: selectedReports,
        resolvedBy: 'current-user-id', // TODO: Get from auth
        note: bulkResolveNote || undefined
      });
      
      toast.success(`Resolved ${selectedReports.length} reports`);
      setSelectedReports([]);
      setBulkResolveOpen(false);
      setBulkResolveNote('');
      loadReports();
    } catch (error) {
      console.error('Failed to bulk resolve reports:', error);
      toast.error('Failed to resolve reports');
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports Queue</h1>
          <p className="text-muted-foreground">Review and resolve content reports</p>
        </div>
        {selectedReports.length > 0 && (
          <Dialog open={bulkResolveOpen} onOpenChange={setBulkResolveOpen}>
            <DialogTrigger asChild>
              <Button>
                <CheckSquare className="w-4 h-4 mr-2" />
                Resolve Selected ({selectedReports.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Resolve Reports</DialogTitle>
                <DialogDescription>
                  Resolve {selectedReports.length} selected reports. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bulk-note">Resolution Note (Optional)</Label>
                  <Textarea
                    id="bulk-note"
                    placeholder="Add a note about the resolution..."
                    value={bulkResolveNote}
                    onChange={(e) => setBulkResolveNote(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkResolveOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkResolve} disabled={resolving}>
                  {resolving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Resolve {selectedReports.length} Reports
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="state-filter">State</Label>
              <Select value={filters.state} onValueChange={(value) => handleFilterChange('state', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="target-filter">Target Type</Label>
              <Select value={filters.targetType || 'all'} onValueChange={(value) => handleFilterChange('targetType', value === 'all' ? undefined : value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="entry_point">Entry Points</SelectItem>
                  <SelectItem value="prompt_segment">Prompt Segments</SelectItem>
                  <SelectItem value="npc">NPCs</SelectItem>
                  <SelectItem value="turn">Turns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="since-filter">Since</Label>
              <Select value={filters.since?.toString() || '7'} onValueChange={(value) => handleFilterChange('since', parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reports ({reports.length})</CardTitle>
          <CardDescription>
            {selectedReports.length > 0 && `${selectedReports.length} selected`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading reports...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedReports.length === reports.length && reports.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedReports.includes(report.id)}
                        onCheckedChange={(checked) => handleSelectReport(report.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          {getTargetTypeBadge(report.target_type)}
                          <span className="font-mono text-sm">{report.target_id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={report.reason}>
                        {report.reason}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{report.reporter_id}</span>
                    </TableCell>
                    <TableCell>
                      {new Date(report.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {getStateBadge(report)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        {!report.resolved && (
                          <Button variant="outline" size="sm">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {!loading && reports.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No reports found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
