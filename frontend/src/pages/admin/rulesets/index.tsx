/**
 * Rulesets Admin Page
 * List and manage rulesets
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { rulesetsService, type Ruleset, type RulesetFilters } from '@/services/admin.rulesets';
import { RulesetForm } from '@/admin/components/RulesetForm';

export default function RulesetsAdmin() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRuleset, setEditingRuleset] = useState<Ruleset | null>(null);

  useEffect(() => {
    loadRulesets();
  }, [searchQuery, activeFilter]);

  const loadRulesets = async () => {
    try {
      setLoading(true);
      const filters: RulesetFilters = {
        search: searchQuery || undefined,
        status: activeFilter === 'all' ? undefined : (activeFilter === 'active' ? 'active' : 'draft')
      };
      
      const response = await rulesetsService.listRulesets(filters);
      setRulesets(response.data || []);
    } catch (error) {
      console.error('Failed to load rulesets:', error);
      toast.error('Failed to load rulesets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      await rulesetsService.createRuleset(data);
      await loadRulesets();
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Failed to create ruleset:', error);
      throw error;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingRuleset) return;
    
    try {
      await rulesetsService.updateRuleset(editingRuleset.id, data);
      await loadRulesets();
      setEditingRuleset(null);
    } catch (error) {
      console.error('Failed to update ruleset:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ruleset?')) return;
    
    try {
      await rulesetsService.deleteRuleset(id);
      await loadRulesets();
      toast.success('Ruleset deleted successfully');
    } catch (error) {
      console.error('Failed to delete ruleset:', error);
      toast.error('Failed to delete ruleset');
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await rulesetsService.toggleStatus(id);
      await loadRulesets();
      toast.success('Ruleset status updated');
    } catch (error) {
      console.error('Failed to toggle ruleset status:', error);
      toast.error('Failed to update ruleset status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rulesets</h1>
          <p className="text-gray-600">Manage game rulesets</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Ruleset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Ruleset</DialogTitle>
              <DialogDescription>
                Create a new game ruleset
              </DialogDescription>
            </DialogHeader>
            <RulesetForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search rulesets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rulesets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rulesets ({rulesets.length})</CardTitle>
          <CardDescription>
            Manage your game rulesets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : rulesets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No rulesets found</p>
              <p className="text-sm">Create your first ruleset to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rulesets.map((ruleset) => (
                  <TableRow key={ruleset.id}>
                    <TableCell className="font-medium">{ruleset.name}</TableCell>
                    <TableCell className="text-gray-500">{ruleset.slug}</TableCell>
                    <TableCell>
                      <Badge variant={ruleset.status === 'active' ? 'default' : 'secondary'}>
                        {ruleset.status === 'active' ? 'Active' : ruleset.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {ruleset.description || 'No description'}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {new Date(ruleset.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(ruleset.id)}
                        >
                          {ruleset.status === 'active' ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRuleset(ruleset)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(ruleset.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Edit Modal */}
      {editingRuleset && (
        <Dialog open={!!editingRuleset} onOpenChange={() => setEditingRuleset(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Ruleset</DialogTitle>
              <DialogDescription>
                Update ruleset information
              </DialogDescription>
            </DialogHeader>
            <RulesetForm
              ruleset={editingRuleset}
              onSubmit={handleUpdate}
              onCancel={() => setEditingRuleset(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}




