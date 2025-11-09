/**
 * Extras Form Component
 * Dynamic form renderer from JSON Schema field definitions
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import Ajv from 'ajv';
import { StringField } from './fields/StringField';
import { NumberField } from './fields/NumberField';
import { BooleanField } from './fields/BooleanField';
import { EnumField } from './fields/EnumField';
import { ArrayField } from './fields/ArrayField';
import { ObjectField } from './fields/ObjectField';

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
}

interface ExtrasFormProps {
  packType: PackType;
  packId: string;
  initialExtras?: Record<string, unknown> | null;
  onSuccess?: () => void;
}

// Initialize Ajv
// Note: Format validation (ajv-formats) is optional
// We skip format validation for now due to compatibility issues with ajv v8
const ajv = new Ajv({ allErrors: true, strict: false });

// TODO: Re-enable ajv-formats once compatibility with ajv v8 is confirmed
// For now, validation works without format checks (email, date, etc. won't be validated)
// This is acceptable as format validation is a nice-to-have, not critical

export function ExtrasForm({ packType, packId, initialExtras, onSuccess }: ExtrasFormProps) {
  const queryClient = useQueryClient();
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [extras, setExtras] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationSummary, setValidationSummary] = useState<string[]>([]);
  const firstErrorRef = useRef<HTMLDivElement>(null);

  // Fetch field definitions
  const { data: fieldDefs, isLoading: loadingDefs } = useQuery({
    queryKey: ['admin', 'field-defs', packType, showDeprecated ? 'all' : 'active'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('packType', packType);
      if (!showDeprecated) params.set('status', 'active');
      const res = await api.get(`/api/admin/field-defs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch field definitions');
      return res.data as FieldDefinition[];
    },
  });

  // Fetch templates to check usage
  const { data: templates } = useQuery({
    queryKey: ['admin', 'templates', 'active', packType],
    queryFn: async () => {
      const res = await api.get(`/api/admin/templates/active?type=${packType}`);
      if (!res.ok) return [];
      return res.data as Array<{ slot: string; body: string }>;
    },
  });

  // Build composite schema and find used fields
  const { compositeSchema, usedFields } = useMemo(() => {
    if (!fieldDefs) return { compositeSchema: null, usedFields: new Set<string>() };

    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    const used = new Set<string>();

    // Check template usage
    if (templates) {
      for (const template of templates) {
        const matches = template.body.match(/\{\{extras\.(\w+)\}\}/g);
        if (matches) {
          matches.forEach(match => {
            const key = match.replace(/\{\{extras\.(\w+)\}\}/, '$1');
            used.add(key);
          });
        }
      }
    }

    for (const def of fieldDefs) {
      if (def.status === 'deprecated' && !showDeprecated) continue;
      properties[def.key] = def.schema_json;
      const schema = def.schema_json as { required?: boolean };
      if (schema.required) {
        required.push(def.key);
      }
    }

    return {
      compositeSchema: {
        type: 'object',
        properties,
        additionalProperties: false,
        ...(required.length > 0 ? { required } : {}),
      },
      usedFields: used,
    };
  }, [fieldDefs, templates, showDeprecated]);

  // Initialize extras with defaults
  useEffect(() => {
    if (fieldDefs && !initialExtras) {
      const defaults: Record<string, unknown> = {};
      for (const def of fieldDefs) {
        if (def.default_json !== null && !(def.key in defaults)) {
          defaults[def.key] = def.default_json;
        }
      }
      setExtras(defaults);
    } else if (initialExtras) {
      setExtras(initialExtras);
    }
  }, [fieldDefs, initialExtras]);

  // Validate extras
  const validate = (extrasToValidate: Record<string, unknown>): boolean => {
    if (!compositeSchema) return true;

    const validateFn = ajv.compile(compositeSchema);
    const valid = validateFn(extrasToValidate);

    if (!valid) {
      const fieldErrors: Record<string, string> = {};
      const summary: string[] = [];

      for (const error of validateFn.errors || []) {
        const field = error.instancePath.replace('/', '') || error.params?.property || 'root';
        fieldErrors[field] = error.message || 'Validation error';
        summary.push(`${field}: ${error.message || 'Validation error'}`);
      }

      setErrors(fieldErrors);
      setValidationSummary(summary);
      return false;
    }

    setErrors({});
    setValidationSummary([]);
    return true;
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (extrasToSave: Record<string, unknown>) => {
      const res = await api.post(`/api/admin/${packType}/${packId}/extras`, {
        extras: extrasToSave,
      });
      if (!res.ok) throw new Error(res.error || 'Failed to save extras');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Extras saved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', packType, packId] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save extras');
    },
  });

  const handleSubmit = () => {
    if (!validate(extras)) {
      // Scroll to first error
      setTimeout(() => {
        firstErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
    saveMutation.mutate(extras);
  };

  const handleFieldChange = (key: string, value: unknown) => {
    const newExtras = { ...extras, [key]: value };
    setExtras(newExtras);
    // Validate on change
    validate(newExtras);
  };

  // Group fields by group_label
  const groupedFields = fieldDefs?.reduce((acc, def) => {
    if (def.status === 'deprecated' && !showDeprecated) return acc;
    const group = def.group_label || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(def);
    return acc;
  }, {} as Record<string, FieldDefinition[]>) || {};

  // Sort groups and fields
  const sortedGroups = Object.keys(groupedFields).sort();
  for (const group of sortedGroups) {
    groupedFields[group].sort((a, b) => a.key.localeCompare(b.key));
  }

  if (loadingDefs) {
    return <div>Loading field definitions...</div>;
  }

  if (!fieldDefs || fieldDefs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No field definitions found for {packType}. Create fields in the Field Registry.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Extras</CardTitle>
            <CardDescription>Custom fields for this {packType}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-deprecated"
              checked={showDeprecated}
              onCheckedChange={setShowDeprecated}
            />
            <Label htmlFor="show-deprecated" className="text-sm cursor-pointer">
              Show deprecated
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {validationSummary.length > 0 && (
          <Alert variant="destructive" ref={firstErrorRef}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {validationSummary.map((msg, i) => (
                  <div key={i} className="text-sm">{msg}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {sortedGroups.map((group) => (
          <div key={group}>
            <h3 className="font-semibold mb-4">{group}</h3>
            <div className="space-y-4">
              {groupedFields[group].map((def) => {
                const fieldValue = extras[def.key];
                const fieldError = errors[def.key];
                const isRequired = compositeSchema?.required?.includes(def.key);
                const isUsed = usedFields.has(def.key);

                const schema = def.schema_json as Record<string, unknown>;
                const fieldPath = def.key;

                // Render appropriate field component
                if (schema.type === 'string') {
                  if (schema.enum) {
                    return (
                      <div key={def.key}>
                        <div className="flex items-center gap-2 mb-2">
                          {isUsed && (
                            <Badge variant="outline" className="text-xs">
                              <Info className="h-3 w-3 mr-1" />
                              Used in templates
                            </Badge>
                          )}
                        </div>
                        <EnumField
                          label={def.label}
                          value={fieldValue as string | number | null}
                          onChange={(v) => handleFieldChange(def.key, v)}
                          error={fieldError}
                          required={isRequired}
                          schema={{ enum: schema.enum as (string | number)[], description: def.help || schema.description as string }}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={def.key}>
                      <div className="flex items-center gap-2 mb-2">
                        {isUsed && (
                          <Badge variant="outline" className="text-xs">
                            <Info className="h-3 w-3 mr-1" />
                            Used in templates
                          </Badge>
                        )}
                      </div>
                      <StringField
                        label={def.label}
                        value={(fieldValue as string) || ''}
                        onChange={(v) => handleFieldChange(def.key, v)}
                        error={fieldError}
                        required={isRequired}
                        schema={{
                          ...schema,
                          description: def.help || schema.description as string,
                        }}
                      />
                    </div>
                  );
                }

                if (schema.type === 'number' || schema.type === 'integer') {
                  return (
                    <div key={def.key}>
                      <div className="flex items-center gap-2 mb-2">
                        {isUsed && (
                          <Badge variant="outline" className="text-xs">
                            <Info className="h-3 w-3 mr-1" />
                            Used in templates
                          </Badge>
                        )}
                      </div>
                      <NumberField
                        label={def.label}
                        value={(fieldValue as number) || ''}
                        onChange={(v) => handleFieldChange(def.key, v)}
                        error={fieldError}
                        required={isRequired}
                        schema={schema}
                        isInteger={schema.type === 'integer'}
                      />
                    </div>
                  );
                }

                if (schema.type === 'boolean') {
                  return (
                    <div key={def.key}>
                      <div className="flex items-center gap-2 mb-2">
                        {isUsed && (
                          <Badge variant="outline" className="text-xs">
                            <Info className="h-3 w-3 mr-1" />
                            Used in templates
                          </Badge>
                        )}
                      </div>
                      <BooleanField
                        label={def.label}
                        value={(fieldValue as boolean) || false}
                        onChange={(v) => handleFieldChange(def.key, v)}
                        error={fieldError}
                        required={isRequired}
                        schema={{ description: def.help || schema.description as string }}
                      />
                    </div>
                  );
                }

                if (schema.type === 'array') {
                  return (
                    <div key={def.key}>
                      <div className="flex items-center gap-2 mb-2">
                        {isUsed && (
                          <Badge variant="outline" className="text-xs">
                            <Info className="h-3 w-3 mr-1" />
                            Used in templates
                          </Badge>
                        )}
                      </div>
                      <ArrayField
                        label={def.label}
                        value={(fieldValue as unknown[]) || []}
                        onChange={(v) => handleFieldChange(def.key, v)}
                        error={fieldError}
                        required={isRequired}
                        schema={schema}
                        path={fieldPath}
                      />
                    </div>
                  );
                }

                if (schema.type === 'object') {
                  return (
                    <div key={def.key}>
                      <div className="flex items-center gap-2 mb-2">
                        {isUsed && (
                          <Badge variant="outline" className="text-xs">
                            <Info className="h-3 w-3 mr-1" />
                            Used in templates
                          </Badge>
                        )}
                      </div>
                      <div className="border rounded p-4">
                        <ObjectField
                          value={(fieldValue as Record<string, unknown>) || {}}
                          onChange={(v) => handleFieldChange(def.key, v)}
                          schema={schema}
                          path={fieldPath}
                          title={def.label}
                        />
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSubmit}
            disabled={saveMutation.isPending || validationSummary.length > 0}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Extras
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

