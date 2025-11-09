/**
 * Loadouts Admin Page
 * List and view loadouts
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Package } from 'lucide-react';
import { api } from '@/lib/api';

interface Loadout {
  id: string;
  base_id: string;
  version: number;
  title: string;
  description?: string;
  ruleset_id: string;
  modules: string[];
  overrides?: Record<string, { params?: Record<string, unknown> }>;
  created_at: string;
}

export default function Loadouts() {
  const navigate = useNavigate();

  const { data: loadouts, isLoading, error } = useQuery({
    queryKey: ['admin', 'loadouts'],
    queryFn: async () => {
      const res = await api.get('/api/admin/loadouts');
      if (!res.ok) throw new Error('Failed to fetch loadouts');
      return res.data as Loadout[];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Loadouts</h1>
        <p className="text-muted-foreground">
          Preset configurations: ruleset + modules + param overrides
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loadout List</CardTitle>
          <CardDescription>
            View available loadouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading loadouts...
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              Failed to load loadouts
            </div>
          )}

          {loadouts && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Ruleset</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No loadouts found
                    </TableCell>
                  </TableRow>
                ) : (
                  loadouts.map((loadout) => (
                    <TableRow key={loadout.id}>
                      <TableCell className="font-mono text-sm">{loadout.id}</TableCell>
                      <TableCell>{loadout.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">v{loadout.version}</Badge>
                      </TableCell>
                      <TableCell>{loadout.ruleset_id}</TableCell>
                      <TableCell>
                        <Badge>{loadout.modules.length} modules</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/loadouts/${loadout.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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

