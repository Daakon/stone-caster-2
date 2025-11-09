/**
 * Field Registry Admin Page
 * Manage dynamic field definitions for pack extras
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { FieldEditor } from '@/components/admin/FieldEditor';
import Ajv from 'ajv';

type PackType = 'world' | 'ruleset' | 'npc' | 'scenario';

interface FieldDefinition {
  id: number;
  pack_type: PackType;
  key: string;
  label: string;
  group_label: string | null;
  schema_json: Record<string, unknown>;
  default_json: unknown | null;
  help: string | null;
  status: 'active' | 'deprecated';
  created_at: string;
  updated_at: string;
}

export default function FieldRegistry() {
  const queryClient = useQueryClient();
  const [selectedPackType, setSelectedPackType] = useState<PackType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'deprecated' | 'all'>('all');
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch field definitions
  const { data: fields, isLoading } = useQuery({
    queryKey: ['admin', 'field-defs', selectedPackType, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPackType !== 'all') params.set('packType', selectedPackType);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get(`/api/admin/field-defs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch field definitions');
      return res.data as FieldDefinition[];
    },
  });

  // Deprecate mutation
  const deprecateMutation = useMutation({
    mutationFn: async ({ packType, key }: { packType: PackType; key: string }) => {
      const res = await api.post(`/api/admin/field-defs/${packType}/${key}/deprecate`);
      if (!res.ok) throw new Error('Failed to deprecate field');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Field deprecated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'field-defs'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to deprecate field');
    },
  });

  const handleEdit = (field: FieldDefinition) => {
    setEditingField(field);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingField(null);
    setIsDialogOpen(true);
  };

  const handleDeprecate = (field: FieldDefinition) => {
    if (confirm(`Deprecate field "${field.label}"? It will be hidden from forms but not deleted.`)) {
      deprecateMutation.mutate({ packType: field.pack_type, key: field.key });
    }
  };

  // Group fields by group_label
  const groupedFields = fields?.reduce((acc, field) => {
    const group = field.group_label || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(field);
    return acc;
  }, {} as Record<string, FieldDefinition[]>) || {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Field Registry</h1>
          <p className="text-muted-foreground">
            Manage dynamic field definitions for pack extras
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Field
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>
            <div className="flex gap-4 items-center mt-2">
              <Select value={selectedPackType} onValueChange={(v) => setSelectedPackType(v as PackType | 'all')}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="world">World</SelectItem>
                  <SelectItem value="ruleset">Ruleset</SelectItem>
                  <SelectItem value="npc">NPC</SelectItem>
                  <SelectItem value="scenario">Scenario</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedFields).map(([group, groupFields]) => (
                <div key={group}>
                  <h3 className="font-semibold mb-2">{group}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Pack Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupFields.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell className="font-mono text-xs">{field.key}</TableCell>
                          <TableCell>{field.label}</TableCell>
                          <TableCell>{field.pack_type}</TableCell>
                          <TableCell>
                            <Badge variant={field.status === 'active' ? 'default' : 'secondary'}>
                              {field.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEdit(field)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              {field.status === 'active' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeprecate(field)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isDialogOpen && (
        <FieldEditor
          field={editingField}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingField(null);
          }}
          onSuccess={() => {
            setIsDialogOpen(false);
            setEditingField(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'field-defs'] });
          }}
        />
      )}
    </div>
  );
}

