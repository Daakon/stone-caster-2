/**
 * AWF Core Rulesets Admin Page
 * Phase 1: Core vs Rulesets Framework Split - Ruleset management
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Edit, 
  Save, 
  X, 
  Download,
  Upload,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { awfAdminService, type AwfCoreRuleset } from '@/services/awfAdminService';

export default function AwfRulesetsAdmin() {
  const [rulesets, setRulesets] = useState<AwfCoreRuleset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRuleset, setEditingRuleset] = useState<AwfCoreRuleset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    version: '',
    doc: '{}'
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const hasLoaded = useRef(false);

  // Helper function to create default ruleset document structure
  const createDefaultRulesetDocument = () => {
    return JSON.stringify({
      ruleset: {
        name: "Default Narrative & Pacing",
        "scn.phases": ["setup", "play", "resolution"],
        "txt.policy": "2–6 sentences, cinematic, second-person. No mechanics in txt; mechanics only in acts.",
        "choices.policy": "Only when a menu is available; 1–5 items; label ≤ 48 chars; include a stable id per item.",
        language: { 
          one_language_only: true, 
          use_meta_locale: true 
        },
        mechanics_visibility: { 
          no_mechanics_in_txt: true 
        },
        safety: {
          consent_required_for_impactful_actions: true,
          offer_player_reaction_when_npc_initiates: true
        },
        token_discipline: {
          npcs_active_cap: 5,
          sim_nearby_token_cap: 260,
          mods_micro_slice_cap_per_namespace: 80,
          mods_micro_slice_cap_global: 200,
          episodic_cap: 60,
          episodic_note_max_chars: 120
        },
        time: { 
          bands_cycle: ["Dawn", "Mid-Day", "Evening", "Mid-Night"], 
          ticks_per_band: 60 
        },
        menus: { 
          min_choices: 1, 
          max_choices: 5, 
          label_max_chars: 48 
        },
        defaults: {
          txt_sentences_min: 2,
          txt_sentences_max: 6,
          time_ticks_min_step: 1,
          cooldowns: { 
            dialogue_candidate_cooldown_turns: 1 
          }
        }
      }
    }, null, 2);
  };

  // Load rulesets on mount
  useEffect(() => {
    if (hasLoaded.current) {
      return;
    }
    
    loadRulesets();
  }, []);

  const loadRulesets = async () => {
    if (hasLoaded.current) {
      return;
    }
    
    hasLoaded.current = true;
    setLoading(true);
    
    try {
      const response = await awfAdminService.getCoreRulesets();
      if (response.ok && response.data) {
        setRulesets(response.data);
      } else {
        setError(response.error || 'Failed to load rulesets');
      }
    } catch (error) {
      console.error('Error loading rulesets:', error);
      setError('Failed to load rulesets');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ruleset: AwfCoreRuleset) => {
    setEditingRuleset(ruleset);
    setFormData({
      id: ruleset.id,
      version: ruleset.version,
      doc: JSON.stringify(ruleset.doc, null, 2)
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleNew = () => {
    setEditingRuleset(null);
    setFormData({
      id: '',
      version: '',
      doc: createDefaultRulesetDocument()
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingRuleset(null);
    setFormData({
      id: '',
      version: '',
      doc: createDefaultRulesetDocument()
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
      
      // Validate document structure matches CoreRulesetV1 schema
      if (!doc.ruleset) {
        errors.push('Document must have a "ruleset" object');
      } else {
        if (!doc.ruleset.name || typeof doc.ruleset.name !== 'string') {
          errors.push('Ruleset name is required and must be a string');
        }
        if (!Array.isArray(doc.ruleset['scn.phases']) || doc.ruleset['scn.phases'].length === 0) {
          errors.push('Ruleset scn.phases must be a non-empty array');
        }
        if (!doc.ruleset['txt.policy'] || typeof doc.ruleset['txt.policy'] !== 'string') {
          errors.push('Ruleset txt.policy is required and must be a string');
        }
        if (!doc.ruleset['choices.policy'] || typeof doc.ruleset['choices.policy'] !== 'string') {
          errors.push('Ruleset choices.policy is required and must be a string');
        }
        if (!doc.ruleset.defaults) {
          errors.push('Ruleset defaults object is required');
        } else {
          if (typeof doc.ruleset.defaults.txt_sentences_min !== 'number' || doc.ruleset.defaults.txt_sentences_min < 1) {
            errors.push('Defaults txt_sentences_min must be a number >= 1');
          }
          if (typeof doc.ruleset.defaults.txt_sentences_max !== 'number' || doc.ruleset.defaults.txt_sentences_max < 1) {
            errors.push('Defaults txt_sentences_max must be a number >= 1');
          }
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
      const response = await awfAdminService.createCoreRuleset({
        id: formData.id,
        version: formData.version,
        doc
      });

      if (response.ok) {
        toast.success('Ruleset saved successfully');
        await loadRulesets();
        handleCancel();
      } else {
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
          toast.error(response.error || 'Failed to save ruleset');
        }
      }
    } catch (error) {
      console.error('Error saving ruleset:', error);
      toast.error('Failed to save ruleset');
    }
  };

  const handleDelete = async (id: string, version: string) => {
    if (!confirm(`Are you sure you want to delete ruleset ${id}@${version}?`)) {
      return;
    }

    try {
      const response = await awfAdminService.deleteCoreRuleset(id, version);
      if (response.ok) {
        toast.success('Ruleset deleted successfully');
        await loadRulesets();
      } else {
        toast.error(response.error || 'Failed to delete ruleset');
      }
    } catch (error) {
      console.error('Error deleting ruleset:', error);
      toast.error('Failed to delete ruleset');
    }
  };

  const handleExport = (ruleset: AwfCoreRuleset) => {
    const exportData = {
      id: ruleset.id,
      version: ruleset.version,
      doc: ruleset.doc
    };
    awfAdminService.exportDocument(exportData, `${ruleset.id}.${ruleset.version}.json`);
    toast.success('Ruleset exported successfully');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    awfAdminService.importDocument(file)
      .then((data) => {
        setFormData({
          id: data.id || '',
          version: data.version || '',
          doc: JSON.stringify(data.doc || {}, null, 2)
        });
        setIsEditing(true);
        toast.success('Ruleset imported successfully');
      })
      .catch((error) => {
        toast.error('Failed to import ruleset: ' + error.message);
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Error loading rulesets</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadRulesets}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Core Rulesets</h1>
          <p className="text-muted-foreground">
            Manage AWF narrative/pacing/style policies (separated from Core Contracts)
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            id="import-ruleset"
          />
          <label htmlFor="import-ruleset">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </label>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Ruleset
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
              {editingRuleset ? 'Edit Ruleset' : 'New Ruleset'}
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
                  placeholder="e.g., core.default"
                />
              </div>
              <div>
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="e.g., 1.0.0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="doc">Ruleset Document (JSON)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Required structure: ruleset (name, scn.phases, txt.policy, choices.policy, defaults, and optional language, token_discipline, time, menus, mechanics_visibility, safety)
              </p>
              <Textarea
                id="doc"
                value={formData.doc}
                onChange={(e) => setFormData({ ...formData, doc: e.target.value })}
                placeholder="Enter JSON document..."
                rows={15}
                className="font-mono text-sm"
              />
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

      {/* Rulesets List */}
      <div className="grid gap-4">
        {rulesets.map((ruleset) => (
          <Card key={`${ruleset.id}-${ruleset.version}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-lg">
                    {ruleset.id}@{ruleset.version}
                  </CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(ruleset)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(ruleset)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(ruleset.id, ruleset.version)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <strong>Updated:</strong> {new Date(ruleset.updated_at).toLocaleString()}
                </div>
                {(ruleset.doc as any)?.ruleset?.name && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Name:</strong> {(ruleset.doc as any).ruleset.name}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rulesets.length === 0 && !isEditing && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No rulesets found.</p>
            <Button onClick={handleNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Ruleset
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
