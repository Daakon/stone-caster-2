/**
 * AWF Core Contracts Admin Page
 * Phase 2: Admin UI - Core contract management
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Edit, 
  Save, 
  X, 
  Download,
  Upload,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { awfAdminService, type AwfCoreContract } from '@/services/awfAdminService';

export default function AwfCoreContractsAdmin() {
  const [contracts, setContracts] = useState<AwfCoreContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingContract, setEditingContract] = useState<AwfCoreContract | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    version: '',
    doc: '{}',
    active: false
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load contracts on mount
  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const response = await awfAdminService.getCoreContracts();
      if (response.ok && response.data) {
        setContracts(response.data);
      } else {
        toast.error(response.error || 'Failed to load contracts');
      }
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contract: AwfCoreContract) => {
    setEditingContract(contract);
    setFormData({
      id: contract.id,
      version: contract.version,
      doc: JSON.stringify(contract.doc, null, 2),
      active: contract.active
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleNew = () => {
    setEditingContract(null);
    setFormData({
      id: '',
      version: '',
      doc: '{}',
      active: false
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingContract(null);
    setFormData({
      id: '',
      version: '',
      doc: '{}',
      active: false
    });
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.id.trim()) {
      errors.push('ID is required');
    }

    if (!formData.version.trim()) {
      errors.push('Version is required');
    }

    try {
      JSON.parse(formData.doc);
    } catch (error) {
      errors.push('Document must be valid JSON');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const doc = JSON.parse(formData.doc);
      const response = await awfAdminService.createCoreContract({
        id: formData.id,
        version: formData.version,
        doc,
        active: formData.active
      });

      if (response.ok) {
        toast.success('Contract saved successfully');
        await loadContracts();
        handleCancel();
      } else {
        toast.error(response.error || 'Failed to save contract');
      }
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error('Failed to save contract');
    }
  };

  const handleActivate = async (id: string, version: string) => {
    try {
      const response = await awfAdminService.activateCoreContract(id, version);
      if (response.ok) {
        toast.success('Contract activated successfully');
        await loadContracts();
      } else {
        toast.error(response.error || 'Failed to activate contract');
      }
    } catch (error) {
      console.error('Error activating contract:', error);
      toast.error('Failed to activate contract');
    }
  };

  const handleExport = (contract: AwfCoreContract) => {
    const exportData = {
      id: contract.id,
      version: contract.version,
      hash: contract.hash,
      doc: contract.doc
    };
    awfAdminService.exportDocument(exportData, `${contract.id}.${contract.version}.json`);
    toast.success('Contract exported successfully');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    awfAdminService.importDocument(file)
      .then((data) => {
        setFormData({
          id: data.id || '',
          version: data.version || '',
          doc: JSON.stringify(data.doc || {}, null, 2),
          active: data.active || false
        });
        setIsEditing(true);
        toast.success('Contract imported successfully');
      })
      .catch((error) => {
        toast.error('Failed to import contract: ' + error.message);
      });

    // Reset file input
    event.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Core Contracts</h1>
          <p className="text-muted-foreground">
            Manage AWF core contract documents
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            id="import-contract"
          />
          <label htmlFor="import-contract">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </label>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Editor Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingContract ? 'Edit Contract' : 'New Contract'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="id">ID</Label>
                <Input
                  id="id"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="e.g., core.contract.v4"
                />
              </div>
              <div>
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="e.g., v4"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="doc">Document (JSON)</Label>
              <Textarea
                id="doc"
                value={formData.doc}
                onChange={(e) => setFormData({ ...formData, doc: e.target.value })}
                placeholder="Enter JSON document..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contracts List */}
      <div className="grid gap-4">
        {contracts.map((contract) => (
          <Card key={`${contract.id}-${contract.version}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-lg">
                    {contract.id} v{contract.version}
                  </CardTitle>
                  {contract.active && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(contract)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(contract)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {!contract.active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleActivate(contract.id, contract.version)}
                    >
                      Activate
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <strong>Hash:</strong> {contract.hash}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Updated:</strong> {new Date(contract.updated_at).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {contracts.length === 0 && !isEditing && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No core contracts found.</p>
            <Button onClick={handleNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Contract
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


