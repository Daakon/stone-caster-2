/**
 * Entry Points Admin Page
 * Phase 3: Full CRUD interface for entry points management
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Send, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { entryPointsService, type EntryPoint, type EntryPointFilters } from '@/services/admin.entryPoints';
import { useAppRoles } from '@/admin/routeGuard';

export default function EntryPointsAdmin() {
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<EntryPointFilters>({});
  const [search, setSearch] = useState('');
  const [worlds, setWorlds] = useState<Array<{ id: string; name: string }>>([]);

  // Load data
  useEffect(() => {
    loadEntryPoints();
    loadWorlds();
  }, [filters]);

  const loadEntryPoints = async () => {
    try {
      setLoading(true);
      const response = await entryPointsService.listEntryPoints({
        ...filters,
        search: search || undefined
      });
      setEntryPoints(response.data);
    } catch (error) {
      toast.error('Failed to load entry points');
      console.error('Error loading entry points:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorlds = async () => {
    try {
      const worldsData = await entryPointsService.getWorlds();
      setWorlds(worldsData);
    } catch (error) {
      console.error('Error loading worlds:', error);
    }
  };

  const handleSubmitForReview = async (id: string, title: string) => {
    if (!confirm(`Submit '${title}' for moderation?`)) {
      return;
    }

    try {
      await entryPointsService.submitForReview(id);
      toast.success('Entry point submitted for review');
      loadEntryPoints();
    } catch (error) {
      toast.error('Failed to submit for review');
      console.error('Error submitting for review:', error);
    }
  };

  const getLifecycleBadge = (lifecycle: string) => {
    const variants = {
      draft: 'secondary',
      pending_review: 'default',
      changes_requested: 'destructive',
      active: 'default',
      archived: 'outline',
      rejected: 'destructive'
    } as const;

    return (
      <Badge variant={variants[lifecycle as keyof typeof variants] || 'outline'}>
        {lifecycle.replace('_', ' ')}
      </Badge>
    );
  };

  const getVisibilityBadge = (visibility: string) => {
    const variants = {
      public: 'default',
      unlisted: 'secondary',
      private: 'outline'
    } as const;

    return (
      <Badge variant={variants[visibility as keyof typeof variants] || 'outline'}>
        {visibility}
      </Badge>
    );
  };

  const canSubmitForReview = (entryPoint: EntryPoint) => {
    return isCreator && 
           (entryPoint.lifecycle === 'draft' || entryPoint.lifecycle === 'changes_requested');
  };

  const canModerate = (entryPoint: EntryPoint) => {
    return (isModerator || isAdmin) && 
           entryPoint.lifecycle === 'pending_review';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entry Points</h1>
          <p className="text-muted-foreground">
            Manage adventure entry points, scenarios, and game starts
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/entry-points/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Entry Point
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search entry points..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lifecycle">Lifecycle</Label>
              <Select
                value={filters.lifecycle?.[0] || 'all'}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    lifecycle: value === 'all' ? undefined : [value]
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All lifecycles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All lifecycles</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="changes_requested">Changes Requested</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={filters.visibility?.[0] || 'all'}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    visibility: value === 'all' ? undefined : [value]
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All visibility</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="world">World</Label>
              <Select
                value={filters.world_id || 'all'}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    world_id: value === 'all' ? undefined : value
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All worlds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All worlds</SelectItem>
                  {worlds.map(world => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entry Points Table */}
      <Card>
        <CardHeader>
          <CardTitle>Entry Points ({entryPoints.length})</CardTitle>
          <CardDescription>
            Manage your entry points and their lifecycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>World</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entryPoints.map((entryPoint) => (
                  <TableRow key={entryPoint.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium">{entryPoint.title}</div>
                        {entryPoint.subtitle && (
                          <div className="text-sm text-muted-foreground">
                            {entryPoint.subtitle}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entryPoint.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {worlds.find(w => w.id === entryPoint.world_id)?.name || entryPoint.world_id}
                    </TableCell>
                    <TableCell>
                      {getLifecycleBadge(entryPoint.lifecycle)}
                    </TableCell>
                    <TableCell>
                      {getVisibilityBadge(entryPoint.visibility)}
                    </TableCell>
                    <TableCell>
                      {new Date(entryPoint.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/entry-points/${entryPoint.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        
                        {canSubmitForReview(entryPoint) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubmitForReview(entryPoint.id, entryPoint.title)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}

                        {canModerate(entryPoint) && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" disabled>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" disabled>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
