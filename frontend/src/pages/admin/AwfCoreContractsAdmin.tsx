/**
 * AWF Core Contracts Admin Page
 * Phase 2: Admin UI - Core contract management
 */

import { useState, useEffect, useRef } from 'react';
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
import { useAdminStore } from '@/stores/adminStore';

export default function AwfCoreContractsAdmin() {
  const { 
    fetchCoreContracts, 
    getCachedCoreContracts, 
    coreContracts, 
    contractsLoading, 
    contractsError 
  } = useAdminStore();

  // Helper function to create default document structure (framework-only)
  const createDefaultDocument = () => {
    return JSON.stringify({
      contract: {
        name: "StoneCaster Core Contract",
        awf_return: "Return exactly one JSON object named AWF with keys scn, txt, and optional choices, optional acts, optional val. No markdown, no code fences, no extra keys.",
        keys: { required: ["scn","txt"], optional: ["choices","acts","val"] },
        language: { one_language_only: true },
        time: { 
          first_turn_time_advance_allowed: false, 
          require_time_advance_on_nonfirst_turn: true, 
          ticks_min_step: 1 
        },
        menus: { min: 1, max: 5, label_max_chars: 48 },
        validation: { policy: "No extra top-level keys; avoid nulls; compact values." }
      },
      core: {
        acts_catalog: [
        { type: "TIME_ADVANCE", mode: "add_number", target: "time.ticks" },
        { type: "SCENE_SET", mode: "set_value", target: "hot.scene" },
        { type: "OBJECTIVE_UPDATE", mode: "upsert_by_id", target: "hot.objectives" },
        { type: "FLAG_SET", mode: "set_by_key", target: "hot.flags" },
        { type: "REL_DELTA", mode: "merge_delta_by_npc", target: "warm.relationships" },
        { type: "RESOURCE_DELTA", mode: "merge_delta_by_key", target: "mechanics.resources" },
        { type: "EPISODIC_ADD", mode: "append_unique_by_key", target: "warm.episodic" },
        { type: "PIN_ADD", mode: "add_unique", target: "warm.pins" },
        { type: "TAG_MEMORY", mode: "tag_by_key", target: "warm.tags" },
        { type: "MEMORY_REMOVE", mode: "remove_by_key", target: "warm.episodic" },
        { type: "CHECK_RESULT", mode: "append_unique_by_key", target: "mechanics.checks" },
        { type: "APPLY_STATUS", mode: "upsert_by_id", target: "mechanics.status" },
        { type: "ITEM_ADD", mode: "upsert_by_id", target: "economy.inventory" },
        { type: "ITEM_REMOVE", mode: "upsert_by_id", target: "economy.inventory" },
        { type: "EQUIP", mode: "upsert_by_id", target: "economy.equipment" },
        { type: "UNEQUIP", mode: "upsert_by_id", target: "economy.equipment" },
        { type: "PARTY_RECRUIT", mode: "upsert_by_id", target: "party.members" },
        { type: "PARTY_DISMISS", mode: "upsert_by_id", target: "party.members" },
        { type: "PARTY_SET_INTENT", mode: "upsert_by_id", target: "party.intents" }
        ],
        scales: {
          skill: { min: 0, baseline: 50, max: 100 },
          relationship: { min: 0, baseline: 50, max: 100 }
        },
        budgets: { input_max_tokens: 6000, output_max_tokens: 1200 }
      }
    }, null, 2);
  };
  
  const [editingContract, setEditingContract] = useState<AwfCoreContract | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    version: '',
    doc: '{}',
    active: false
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const hasLoaded = useRef(false);

  // Load contracts on mount
  useEffect(() => {
    if (hasLoaded.current) {
      console.log('Core contracts already loaded, skipping duplicate call');
      return;
    }
    
    loadContracts();
  }, []);

  const loadContracts = async () => {
    if (hasLoaded.current) {
      console.log('Core contracts load already in progress, skipping');
      return;
    }
    
    hasLoaded.current = true;
    
    try {
      // Check if we have cached data first
      const cachedContracts = getCachedCoreContracts();
      if (cachedContracts.length > 0) {
        console.log('Using cached core contracts');
        return;
      }

      // Fetch fresh data if no cache
      await fetchCoreContracts();
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('Failed to load contracts');
      hasLoaded.current = false; // Reset on error so we can retry
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
      doc: createDefaultDocument(),
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
      doc: createDefaultDocument(),
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
      const doc = JSON.parse(formData.doc);
      
      // Validate document structure matches new AWF Core Contract schema
      if (!doc.contract) {
        errors.push('Document must have a "contract" object');
      } else {
        if (!doc.contract.awf_return || typeof doc.contract.awf_return !== 'string') {
          errors.push('Contract awf_return is required and must be a string');
        }
        if (!Array.isArray(doc.contract['scn.phases']) || doc.contract['scn.phases'].length === 0) {
          errors.push('Contract scn.phases must be a non-empty array');
        }
        if (!doc.contract['txt.policy'] || typeof doc.contract['txt.policy'] !== 'string') {
          errors.push('Contract txt.policy is required and must be a string');
        }
        if (!doc.contract['choices.policy'] || typeof doc.contract['choices.policy'] !== 'string') {
          errors.push('Contract choices.policy is required and must be a string');
        }
        if (!doc.contract['acts.policy'] || typeof doc.contract['acts.policy'] !== 'string') {
          errors.push('Contract acts.policy is required and must be a string');
        }
      }

      if (!doc.rules) {
        errors.push('Document must have a "rules" object');
      } else {
        // Validate required rules sections
        const requiredRules = ['language', 'scales', 'token_discipline', 'time', 'menus', 'mechanics_visibility', 'safety'];
        for (const rule of requiredRules) {
          if (!doc.rules[rule]) {
            errors.push(`Rules.${rule} is required`);
          }
        }
      }

      if (!Array.isArray(doc.acts_catalog) || doc.acts_catalog.length === 0) {
        errors.push('Acts catalog must be a non-empty array');
      } else {
        // Validate acts catalog items
        for (let i = 0; i < doc.acts_catalog.length; i++) {
          const act = doc.acts_catalog[i];
          if (!act.type || typeof act.type !== 'string') {
            errors.push(`Acts catalog[${i}].type is required and must be a string`);
          }
          if (!act.mode || typeof act.mode !== 'string') {
            errors.push(`Acts catalog[${i}].mode is required and must be a string`);
          }
          if (!act.target || typeof act.target !== 'string') {
            errors.push(`Acts catalog[${i}].target is required and must be a string`);
          }
        }
      }

      if (!doc.defaults) {
        errors.push('Document must have a "defaults" object');
      } else {
        if (typeof doc.defaults.txt_sentences_min !== 'number' || doc.defaults.txt_sentences_min < 1) {
          errors.push('Defaults txt_sentences_min must be a number >= 1');
        }
        if (typeof doc.defaults.txt_sentences_max !== 'number' || doc.defaults.txt_sentences_max < 1) {
          errors.push('Defaults txt_sentences_max must be a number >= 1');
        }
        if (typeof doc.defaults.time_ticks_min_step !== 'number' || doc.defaults.time_ticks_min_step < 1) {
          errors.push('Defaults time_ticks_min_step must be a number >= 1');
        }
        if (!Array.isArray(doc.defaults.time_band_cycle) || doc.defaults.time_band_cycle.length === 0) {
          errors.push('Defaults time_band_cycle must be a non-empty array');
        }
        if (!doc.defaults.cooldowns || typeof doc.defaults.cooldowns.dialogue_candidate_cooldown_turns !== 'number') {
          errors.push('Defaults cooldowns.dialogue_candidate_cooldown_turns is required and must be a number');
        }
      }

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
        // Refresh the store data
        await fetchCoreContracts();
        handleCancel();
      } else {
        // Show detailed validation errors
        if (response.details && Array.isArray(response.details)) {
          const errorMessages = response.details.map((detail: any) => {
            if (typeof detail === 'object' && detail.message) {
              return `${detail.path?.join('.') || 'document'}: ${detail.message}`;
            }
            return detail;
          });
          setValidationErrors(errorMessages);
          toast.error('Validation failed - see errors below');
        } else {
          toast.error(response.error || 'Failed to save contract');
        }
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

  if (contractsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (contractsError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Error loading contracts</h3>
          <p className="text-muted-foreground mb-4">{contractsError}</p>
          <Button onClick={loadContracts}>Try Again</Button>
        </div>
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
              <p className="text-sm text-muted-foreground mb-2">
                Core is framework-only (output contract, acts catalog, scales, budgets). Narrative phases/policies live in Rulesets.
                <br />
                Required structure: contract (awf_return, keys, language, time, menus, validation), core (acts_catalog, scales, budgets)
              </p>
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
        {coreContracts.map((contract) => (
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

      {coreContracts.length === 0 && !isEditing && (
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


