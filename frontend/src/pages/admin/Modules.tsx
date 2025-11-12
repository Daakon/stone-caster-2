/**
 * Modules Admin Page
 * List and manage modules
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Copy, Package } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Module {
  id: string;
  base_id: string;
  version: number;
  title: string;
  description?: string;
  state_slice: string;
  actionCount: number;
  created_at: string;
}

export default function Modules() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stateSliceFilter, setStateSliceFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'modules', search, stateSliceFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (stateSliceFilter) params.set('state_slice', stateSliceFilter);
      
      const res = await api.get(`/api/admin/modules?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch modules');
      return res.data as Module[];
    },
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Module ID copied to clipboard');
  };

  const stateSlices = Array.from(new Set(data?.map(m => m.state_slice) || []));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Modules</h1>
        <p className="text-muted-foreground">
          Manage versioned module manifests with action exports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Module List</CardTitle>
          <CardDescription>
            Search and filter modules by state slice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search modules..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={stateSliceFilter} onValueChange={setStateSliceFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All state slices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All state slices</SelectItem>
                {stateSlices.map(slice => (
                  <SelectItem key={slice} value={slice}>{slice}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading modules...
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              Failed to load modules
            </div>
          )}

          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>State Slice</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No modules found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell className="font-mono text-sm">{module.id}</TableCell>
                      <TableCell>{module.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">v{module.version}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{module.state_slice}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{module.actionCount} actions</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyId(module.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/modules/${module.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

