/**
 * Ruleset Edit Page with Publishing Workflow
 * Enhanced ruleset editor with versioning and publishing capabilities
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { rulesetsService } from '@/services/admin.rulesets';
import { ArrowLeft, Save, Eye, Copy, Download, Upload, History, AlertTriangle } from 'lucide-react';

const rulesetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  slug: z.string().min(1, 'Slug is required').max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  status: z.enum(['draft', 'active', 'archived']),
  prompt: z.union([z.string(), z.object({}).passthrough(), z.record(z.any())]).optional()
});

type RulesetFormData = z.infer<typeof rulesetSchema>;

interface RulesetRevision {
  id: string;
  snapshot: any;
  created_at: string;
  actor?: string;
}

export default function RulesetEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ruleset, setRuleset] = useState<any>(null);
  const [revisions, setRevisions] = useState<RulesetRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<RulesetFormData>({
    resolver: zodResolver(rulesetSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      status: 'draft'
    }
  });

  const watchedStatus = watch('status');

  useEffect(() => {
    if (id) {
      loadRuleset();
    }
  }, [id]);

  const loadRuleset = async () => {
    try {
      setLoading(true);
      const data = await rulesetsService.getRuleset(id!);
      setRuleset(data);
      
      // Set form values
      setValue('name', data.name);
      setValue('slug', data.slug);
      setValue('description', data.description || '');
      setValue('status', data.status);
      
      // Handle prompt - if it's an object, stringify it; if it's a string or has text property, use that
      if (data.prompt) {
        if (typeof data.prompt === 'string') {
          setValue('prompt', data.prompt);
        } else if (data.prompt.text) {
          setValue('prompt', data.prompt.text);
        } else {
          setValue('prompt', JSON.stringify(data.prompt, null, 2));
        }
      }

      // Load revisions
      const revisionData = await rulesetsService.getRulesetRevisions(id!);
      setRevisions(revisionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ruleset');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: RulesetFormData) => {
    if (!ruleset) return;

    try {
      setSaving(true);
      setError(null);

      if (ruleset.is_mutable) {
        // Format prompt - if it's a string, convert to { text: string } format for consistency
        const updateData = { ...data };
        if (updateData.prompt && typeof updateData.prompt === 'string') {
          updateData.prompt = { text: updateData.prompt };
        }
        
        // Update existing ruleset
        const updated = await rulesetsService.updateRuleset(id!, updateData);
        setRuleset(updated);
        setSuccess('Ruleset updated successfully');
      } else {
        setError('Active rulesets are immutable. Clone to edit.');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ruleset');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!ruleset) return;

    try {
      setPublishing(true);
      setError(null);

      const result = await rulesetsService.publishRuleset(id!);
      if (result.success) {
        setRuleset(result.ruleset);
        setSuccess('Ruleset published successfully');
        // Reload to get updated data
        await loadRuleset();
      } else {
        setError(result.error || 'Failed to publish ruleset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish ruleset');
    } finally {
      setPublishing(false);
    }
  };

  const handleClone = async (bumpType: 'major' | 'minor' | 'patch') => {
    if (!ruleset) return;

    try {
      setCloning(true);
      setError(null);

      const result = await rulesetsService.cloneRuleset(id!, bumpType);
      if (result.success) {
        setSuccess(`Ruleset cloned successfully. New version: ${result.newRuleset?.version_semver}`);
        // Navigate to the new ruleset
        navigate(`/admin/rulesets/${result.newRuleset?.id}/edit`);
      } else {
        setError(result.error || 'Failed to clone ruleset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone ruleset');
    } finally {
      setCloning(false);
    }
  };

  const canEdit = ruleset ? rulesetsService.canEdit(ruleset) : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading ruleset...</p>
        </div>
      </div>
    );
  }

  if (!ruleset) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Ruleset not found</p>
        <Button onClick={() => navigate('/admin/rulesets')} className="mt-4">
          Back to Rulesets
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/rulesets')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{ruleset.name}</h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant={ruleset.status === 'active' ? 'default' : 'secondary'}>
                {ruleset.status}
              </Badge>
              <Badge variant="outline">
                v{ruleset.version_semver}
              </Badge>
              {ruleset.published_at && (
                <span className="text-sm text-gray-500">
                  Published {new Date(ruleset.published_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Immutable Warning */}
      {!canEdit && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Active rulesets are immutable. Clone to edit.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="edit" className="space-y-6">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="publish">Publish & Version</TabsTrigger>
          <TabsTrigger value="history">Revision History</TabsTrigger>
        </TabsList>

        {/* Edit Tab */}
        <TabsContent value="edit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ruleset Details</CardTitle>
              <CardDescription>
                {canEdit ? 'Edit the ruleset information' : 'Ruleset information (read-only)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    disabled={!canEdit}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    {...register('slug')}
                    disabled={!canEdit}
                    className={errors.slug ? 'border-red-500' : ''}
                  />
                  {errors.slug && (
                    <p className="text-sm text-red-600 mt-1">{errors.slug.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    disabled={!canEdit}
                    rows={3}
                    className={errors.description ? 'border-red-500' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="prompt">Prompt Content *</Label>
                  <Textarea
                    id="prompt"
                    {...register('prompt')}
                    disabled={!canEdit}
                    rows={8}
                    placeholder="Enter the ruleset's prompt content for AI generation. This is what will be used when assembling prompts for entry points using this ruleset."
                    className={errors.prompt ? 'border-red-500' : ''}
                  />
                  {errors.prompt && (
                    <p className="text-sm text-red-600 mt-1">{errors.prompt.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    The prompt content defines how the AI should behave with this ruleset. This content is required for entry point assembly.
                  </p>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={watchedStatus}
                    onValueChange={(value) => setValue('status', value as 'draft' | 'active' | 'archived')}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {canEdit && (
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="submit"
                      disabled={saving || !isDirty}
                      className="min-w-[100px]"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Publish Tab */}
        <TabsContent value="publish" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publishing & Versioning</CardTitle>
              <CardDescription>
                Publish rulesets and manage versions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Status */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Current Status</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <Badge className="ml-2" variant={ruleset.status === 'active' ? 'default' : 'secondary'}>
                      {ruleset.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-600">Version:</span>
                    <span className="ml-2 font-mono">v{ruleset.version_semver}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Mutable:</span>
                    <span className="ml-2">{ruleset.is_mutable ? 'Yes' : 'No'}</span>
                  </div>
                  {ruleset.published_at && (
                    <div>
                      <span className="text-gray-600">Published:</span>
                      <span className="ml-2">{new Date(ruleset.published_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Publish Actions */}
              {ruleset.status === 'draft' && (
                <div className="space-y-4">
                  <h3 className="font-medium">Publish Ruleset</h3>
                  <p className="text-sm text-gray-600">
                    Publishing will make this ruleset active and immutable. A revision will be created.
                  </p>
                  <Button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="w-full"
                  >
                    {publishing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Publish Ruleset
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Clone Actions */}
              <div className="space-y-4">
                <h3 className="font-medium">Clone Ruleset</h3>
                <p className="text-sm text-gray-600">
                  Create a new version of this ruleset for editing.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleClone('major')}
                    disabled={cloning}
                    className="text-sm"
                  >
                    Major ({ruleset.version_major + 1}.0.0)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleClone('minor')}
                    disabled={cloning}
                    className="text-sm"
                  >
                    Minor ({ruleset.version_major}.{ruleset.version_minor + 1}.0)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleClone('patch')}
                    disabled={cloning}
                    className="text-sm"
                  >
                    Patch ({ruleset.version_major}.{ruleset.version_minor}.{ruleset.version_patch + 1})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revision History</CardTitle>
              <CardDescription>
                Track changes to this ruleset over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {revisions.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No revisions found</p>
              ) : (
                <div className="space-y-4">
                  {revisions.map((revision, index) => (
                    <div key={revision.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <History className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {index === 0 ? 'Current' : `Revision ${revisions.length - index}`}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(revision.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Version: {revision.snapshot.version_semver}</p>
                        <p>Status: {revision.snapshot.status}</p>
                        {revision.actor && (
                          <p>Actor: {revision.actor}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
