/**
 * Chimera Ruleset Templates Dashboard
 * Lists all ruleset templates with CRUD actions
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraService, type RulesetTemplate } from '@/services/admin.chimera';

const RULE_TYPE_COLORS = {
  MAIN_SYSTEM: 'default',
  SUBSYSTEM: 'secondary',
  MODIFIER: 'outline',
} as const;

export default function RulesetTemplatesDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['chimera-ruleset-templates'],
    queryFn: () => chimeraService.listRulesetTemplates(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const handleDelete = async (id: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      await chimeraService.deleteRulesetTemplate(id);
      toast.success('Ruleset template deleted successfully');
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ['chimera-ruleset-templates'] });
    } catch (error) {
      console.error('Error deleting ruleset template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete ruleset template');
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>Failed to load ruleset templates</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ruleset Templates</h1>
          <p className="text-muted-foreground mt-2">
            Manage ruleset templates for the Chimera V2 engine
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/chimera/rulesets/new">
            <Plus className="mr-2 h-4 w-4" />
            Create New Ruleset Template
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Templates</CardTitle>
          <CardDescription>
            {templates?.length || 0} template{templates?.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !templates || templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No ruleset templates found.</p>
              <Button asChild className="mt-4">
                <Link to="/admin/chimera/rulesets/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Template
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Rule Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Exclusions</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.display_name}</TableCell>
                    <TableCell>
                      <Badge variant={RULE_TYPE_COLORS[template.rule_type]}>
                        {template.rule_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{template.rule_category}</TableCell>
                    <TableCell>
                      {template.exclusion_group ? (
                        <Badge variant="secondary">{template.exclusion_group.group_name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{template.version}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/chimera/rulesets/edit/${template.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.id, template.display_name)}
                          disabled={deletingId === template.id}
                        >
                          {deletingId === template.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
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

