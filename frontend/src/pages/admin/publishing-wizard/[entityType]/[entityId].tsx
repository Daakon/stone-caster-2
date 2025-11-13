/**
 * Publishing Wizard Page (Admin Only)
 * Phase 7: Unified preflight checks and snapshot preview
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Loader2, Code } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { isPublishingWizardEnabled } from '@/lib/feature-flags';
import { buildImageUrl } from '@shared/media/url';

interface PreflightResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  media: {
    hasCover: boolean;
    coverApproved: boolean;
    galleryAllApproved: boolean;
    unapprovedGalleryCount: number;
  };
  dependencies: {
    missingRuleset: boolean;
    missingWorld: boolean;
    invalidRefs: string[];
  };
  validation: {
    fieldsMissing: string[];
    fieldsInvalid: string[];
  };
  snapshotPreview: {
    schemaVersion: number;
    prompts: {
      corePrompt: string;
      worldPrompt: string;
      rulesetPrompt: string;
      storyPrompt: string;
    };
    coverMediaId: string | null;
    galleryMediaIds: string[];
  };
}

type WizardStep = 'media' | 'dependencies' | 'validation' | 'snapshot' | 'submit';

export default function PublishingWizardPage() {
  const navigate = useNavigate();
  const { entityType, entityId } = useParams<{ entityType: 'world' | 'story' | 'npc'; entityId: string }>();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<WizardStep>('media');

  // Check feature flag
  if (!isPublishingWizardEnabled()) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertDescription>Publishing wizard is not enabled.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch preflight data (refinement: auto-refresh support)
  const { data: preflight, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['publishing-wizard-preflight', entityType, entityId],
    queryFn: async () => {
      const result = await apiGet<PreflightResult>(
        `/api/publishing-wizard/${entityType}/${entityId}/preflight`
      );
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to fetch preflight');
      }
      return result.data;
    },
    enabled: !!entityType && !!entityId,
    staleTime: 0, // Refinement: Always allow refetch for "Re-run checks"
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const result = await apiPost<{
        submitted: boolean;
        entityId: string;
        publishRequestId: string | null;
        snapshotVersion: number;
      }>(`/api/publishing-wizard/${entityType}/${entityId}/submit`, {});
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to submit');
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast.success('Publish request submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', entityType, entityId] });
      // Navigate back to edit page
      const editPath = entityType === 'story'
        ? `/admin/entry-points/${entityId}`
        : `/admin/${entityType}s/${entityId}`;
      navigate(editPath);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit publish request');
    },
  });

  const steps: { key: WizardStep; label: string }[] = [
    { key: 'media', label: 'Media' },
    { key: 'dependencies', label: 'Dependencies' },
    { key: 'validation', label: 'Validation' },
    { key: 'snapshot', label: 'Snapshot Preview' },
    { key: 'submit', label: 'Submit' },
  ];

  const getStepStatus = (step: WizardStep): 'pass' | 'warning' | 'blocker' | 'pending' => {
    if (!preflight) return 'pending';
    
    if (step === 'media') {
      if (!preflight.media.hasCover || !preflight.media.coverApproved) return 'blocker';
      if (preflight.media.unapprovedGalleryCount > 0) return 'warning';
      return 'pass';
    }
    
    if (step === 'dependencies') {
      if (preflight.dependencies.missingWorld || preflight.dependencies.missingRuleset) return 'blocker';
      if (preflight.dependencies.invalidRefs.length > 0) return 'warning';
      return 'pass';
    }
    
    if (step === 'validation') {
      if (preflight.validation.fieldsMissing.length > 0 || preflight.validation.fieldsInvalid.length > 0) return 'blocker';
      return 'pass';
    }
    
    if (step === 'snapshot') {
      return 'pass'; // Always show preview
    }
    
    if (step === 'submit') {
      if (preflight.blockers.length > 0) return 'blocker';
      return 'pass';
    }
    
    return 'pending';
  };

  const canProceed = (step: WizardStep): boolean => {
    const status = getStepStatus(step);
    return status === 'pass' || status === 'warning';
  };

  const handleNext = () => {
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      if (canProceed(currentStep) || nextStep.key === 'snapshot' || nextStep.key === 'submit') {
        setCurrentStep(nextStep.key);
      }
    }
  };

  const handleBack = () => {
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].key);
    }
  };

  const handleSubmit = () => {
    if (preflight && preflight.blockers.length === 0) {
      submitMutation.mutate();
    } else {
      toast.error('Cannot submit: please fix all blockers first');
    }
  };

  const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL;

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => {
          const editPath = entityType === 'story'
            ? `/admin/entry-points/${entityId}`
            : `/admin/${entityType}s/${entityId}`;
          navigate(editPath);
        }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Publishing Wizard</h1>
          <p className="text-muted-foreground">
            Review and submit {entityType} for publishing
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {steps.map((step, index) => {
          const status = getStepStatus(step.key);
          const isActive = step.key === currentStep;
          return (
            <div
              key={step.key}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                isActive ? 'border-primary bg-primary/5' : 'border-muted'
              }`}
            >
              {status === 'pass' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
              {status === 'blocker' && <XCircle className="h-4 w-4 text-red-600" />}
              {status === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <span className={isActive ? 'font-semibold' : ''}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      ) : preflight ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {currentStep === 'media' && 'Media Checks'}
                  {currentStep === 'dependencies' && 'Dependencies'}
                  {currentStep === 'validation' && 'Validation'}
                  {currentStep === 'snapshot' && 'Snapshot Preview'}
                  {currentStep === 'submit' && 'Submit for Publishing'}
                </CardTitle>
                <CardDescription>
                  {currentStep === 'media' && 'Review cover image and gallery'}
                  {currentStep === 'dependencies' && 'Check required dependencies'}
                  {currentStep === 'validation' && 'Validate required fields'}
                  {currentStep === 'snapshot' && 'Preview what will be frozen at publish time'}
                  {currentStep === 'submit' && 'Submit this entity for publishing'}
                </CardDescription>
              </div>
              {/* Refinement: Prominent "Re-run checks" button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                {isRefetching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Re-run Checks
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Media Step */}
            {currentStep === 'media' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Cover Image</h3>
                  {preflight.media.hasCover ? (
                    <div className="flex items-center gap-2">
                      {preflight.media.coverApproved ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span>Cover image is approved and ready</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span>Cover image is not approved</span>
                        </>
                      )}
                      {preflight.snapshotPreview.coverMediaId && deliveryUrl && (
                        <img
                          src={buildImageUrl(preflight.snapshotPreview.coverMediaId, 'card', deliveryUrl)}
                          alt="Cover"
                          className="w-32 h-20 object-cover rounded border"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span>No cover image set</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Gallery</h3>
                  {preflight.media.galleryAllApproved ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span>All gallery images are approved</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span>{preflight.media.unapprovedGalleryCount} gallery image(s) need review</span>
                    </div>
                  )}
                </div>

                {preflight.blockers.filter(b => b.includes('cover') || b.includes('media')).length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {preflight.blockers.filter(b => b.includes('cover') || b.includes('media')).map((blocker, i) => (
                          <li key={i}>{blocker}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Dependencies Step */}
            {currentStep === 'dependencies' && (
              <div className="space-y-4">
                {preflight.dependencies.missingWorld && (
                  <Alert variant="destructive">
                    <AlertDescription>World is missing or not published</AlertDescription>
                  </Alert>
                )}
                {preflight.dependencies.missingRuleset && (
                  <Alert variant="destructive">
                    <AlertDescription>Ruleset is missing</AlertDescription>
                  </Alert>
                )}
                {preflight.dependencies.invalidRefs.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      Invalid references: {preflight.dependencies.invalidRefs.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
                {!preflight.dependencies.missingWorld && !preflight.dependencies.missingRuleset && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>All dependencies are valid</span>
                  </div>
                )}
              </div>
            )}

            {/* Validation Step */}
            {currentStep === 'validation' && (
              <div className="space-y-4">
                {preflight.validation.fieldsMissing.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <p className="font-semibold mb-2">Missing required fields:</p>
                      <ul className="list-disc list-inside">
                        {preflight.validation.fieldsMissing.map((field, i) => (
                          <li key={i}>{field}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {preflight.validation.fieldsInvalid.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <p className="font-semibold mb-2">Invalid fields:</p>
                      <ul className="list-disc list-inside">
                        {preflight.validation.fieldsInvalid.map((field, i) => (
                          <li key={i}>{field}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {preflight.validation.fieldsMissing.length === 0 && preflight.validation.fieldsInvalid.length === 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>All required fields are valid</span>
                  </div>
                )}
              </div>
            )}

            {/* Snapshot Preview Step */}
            {currentStep === 'snapshot' && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Schema Version: {preflight.snapshotPreview.schemaVersion}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    This preview shows what will be frozen at publish time. Games created after publishing will use this snapshot.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Core Prompt</h4>
                    <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                      <code>{preflight.snapshotPreview.prompts.corePrompt}</code>
                    </pre>
                  </div>

                  {preflight.snapshotPreview.prompts.worldPrompt && (
                    <div>
                      <h4 className="font-semibold mb-2">World Prompt</h4>
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto max-h-64 overflow-y-auto">
                        <code>{preflight.snapshotPreview.prompts.worldPrompt}</code>
                      </pre>
                    </div>
                  )}

                  {preflight.snapshotPreview.prompts.rulesetPrompt && (
                    <div>
                      <h4 className="font-semibold mb-2">Ruleset Prompt</h4>
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto max-h-64 overflow-y-auto">
                        <code>{preflight.snapshotPreview.prompts.rulesetPrompt}</code>
                      </pre>
                    </div>
                  )}

                  {preflight.snapshotPreview.prompts.storyPrompt && (
                    <div>
                      <h4 className="font-semibold mb-2">Story Prompt</h4>
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto max-h-64 overflow-y-auto">
                        <code>{preflight.snapshotPreview.prompts.storyPrompt}</code>
                      </pre>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-2">Media References</h4>
                    <div className="space-y-2">
                      <p className="text-sm">
                        Cover: {preflight.snapshotPreview.coverMediaId || 'None'}
                      </p>
                      <p className="text-sm">
                        Gallery: {preflight.snapshotPreview.galleryMediaIds.length} image(s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Step */}
            {currentStep === 'submit' && (
              <div className="space-y-4">
                {preflight.blockers.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <p className="font-semibold mb-2">Cannot submit: Please fix the following blockers:</p>
                      <ul className="list-disc list-inside">
                        {preflight.blockers.map((blocker, i) => (
                          <li key={i}>{blocker}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      All checks passed. Ready to submit for publishing.
                    </AlertDescription>
                  </Alert>
                )}

                {preflight.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">Warnings:</p>
                      <ul className="list-disc list-inside">
                        {preflight.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={preflight.blockers.length > 0 || submitMutation.isPending}
                  className="w-full"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit for Publishing'
                  )}
                </Button>
              </div>
            )}

            {/* Navigation buttons */}
            {currentStep !== 'submit' && (
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={handleBack} disabled={currentStep === 'media'}>
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!canProceed(currentStep) && currentStep !== 'snapshot'}>
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <Alert variant="destructive">
              <AlertDescription>Failed to load preflight data</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


