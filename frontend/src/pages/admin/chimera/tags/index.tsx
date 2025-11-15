/**
 * Chimera Tag Management Dashboard
 * Admin interface for managing tags (including approval)
 */

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraService, type ChimeraTag, type CreateTagData, type UpdateTagData } from '@/services/admin.chimera';

export default function TagManagement() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ChimeraTag | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createFormData, setCreateFormData] = useState<CreateTagData>({
    tag_name: '',
    is_approved: false,
  });

  const { data: tags, isLoading, error } = useQuery({
    queryKey: ['chimera-admin-tags'],
    queryFn: () => chimeraService.listTags(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTagData) => chimeraService.createTag(data),
    onSuccess: () => {
      toast.success('Tag created successfully');
      setIsCreateDialogOpen(false);
      setCreateFormData({ tag_name: '', is_approved: false });
      queryClient.invalidateQueries({ queryKey: ['chimera-admin-tags'] });
      // Also invalidate user-facing tags cache
      queryClient.invalidateQueries({ queryKey: ['chimera-tags'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create tag');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagData }) =>
      chimeraService.updateTag(id, data),
    onSuccess: () => {
      toast.success('Tag updated successfully');
      setEditingTag(null);
      queryClient.invalidateQueries({ queryKey: ['chimera-admin-tags'] });
      // Also invalidate user-facing tags cache
      queryClient.invalidateQueries({ queryKey: ['chimera-tags'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tag');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chimeraService.deleteTag(id),
    onSuccess: () => {
      toast.success('Tag deleted successfully');
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ['chimera-admin-tags'] });
      // Also invalidate user-facing tags cache
      queryClient.invalidateQueries({ queryKey: ['chimera-tags'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tag');
      setDeletingId(null);
    },
  });

  const handleCreate = () => {
    if (!createFormData.tag_name.trim()) {
      toast.error('Tag name is required');
      return;
    }
    createMutation.mutate(createFormData);
  };

  const handleUpdateApproval = (tag: ChimeraTag) => {
    updateMutation.mutate({
      id: tag.id,
      data: { is_approved: !tag.is_approved },
    });
  };

  const handleDelete = (tag: ChimeraTag) => {
    if (!confirm(`Are you sure you want to delete "${tag.tag_name}"? This will remove it from all assets.`)) {
      return;
    }
    setDeletingId(tag.id);
    deleteMutation.mutate(tag.id);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>Failed to load tags</p>
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
          <h1 className="text-3xl font-bold">Tag Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage preset tags for user creation wizards
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          Create New Tag
        </Button>
      </div>

      {/* Create Tag Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Create a new tag that users can select in creation wizards
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag_name">Tag Name *</Label>
              <Input
                id="tag_name"
                value={createFormData.tag_name}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, tag_name: e.target.value })
                }
                placeholder="e.g., FANTASY, SCI_FI, HORROR"
                maxLength={100}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_approved"
                checked={createFormData.is_approved}
                onCheckedChange={(checked) =>
                  setCreateFormData({ ...createFormData, is_approved: checked === true })
                }
              />
              <Label htmlFor="is_approved" className="cursor-pointer">
                Approved (visible in user wizards)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Tag'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      {editingTag && (
        <Dialog open={!!editingTag} onOpenChange={() => setEditingTag(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tag</DialogTitle>
              <DialogDescription>
                Update tag name or approval status
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit_tag_name">Tag Name *</Label>
                <Input
                  id="edit_tag_name"
                  value={editingTag.tag_name}
                  onChange={(e) =>
                    setEditingTag({ ...editingTag, tag_name: e.target.value })
                  }
                  maxLength={100}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_is_approved"
                  checked={editingTag.is_approved}
                  onCheckedChange={(checked) =>
                    setEditingTag({ ...editingTag, is_approved: checked === true })
                  }
                />
                <Label htmlFor="edit_is_approved" className="cursor-pointer">
                  Approved (visible in user wizards)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingTag(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!editingTag.tag_name.trim()) {
                    toast.error('Tag name is required');
                    return;
                  }
                  updateMutation.mutate({
                    id: editingTag.id,
                    data: {
                      tag_name: editingTag.tag_name,
                      is_approved: editingTag.is_approved,
                    },
                  });
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Tag'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Tags</CardTitle>
          <CardDescription>
            {tags?.length || 0} tag{tags?.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !tags || tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No tags found.</p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4">
                Create Your First Tag
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium font-mono">{tag.tag_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tag.is_approved ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <Badge variant="default">Approved</Badge>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="secondary">Pending</Badge>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(tag.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateApproval(tag)}
                          disabled={updateMutation.isPending}
                          title={tag.is_approved ? 'Unapprove tag' : 'Approve tag'}
                        >
                          {tag.is_approved ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTag(tag)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tag)}
                          disabled={deletingId === tag.id}
                        >
                          {deletingId === tag.id ? (
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

