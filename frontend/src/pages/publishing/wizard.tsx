/**
 * Publishing Wizard Page
 * Phase 7: Unified step-by-step wizard for creators to publish content
 * Phase 8: Save/resume, rollout, a11y, i18n, analytics
 * Only visible when FF_PUBLISHING_WIZARD is enabled
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, AlertCircle, Loader2, ArrowLeft, ArrowRight, Send, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  isPublishingWizardEnabled,
  isPublishingWizardSessionsEnabled,
  isPublishingWizardRolloutEnabled,
} from '@/lib/feature-flags';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { usePublishingI18n } from '@/lib/i18n/publishing';
import type { QualityIssue } from '@shared/types/publishing';

type WizardStep = 'dependencies' | 'preflight' | 'submit';

export default function PublishingWizardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') as 'world' | 'story' | 'npc' | null;
  const id = searchParams.get('id');
  const { t } = usePublishingI18n();
  const { userId } = useAuthStore();

  // Phase 8: Focus management refs
  const stepRefs = {
    dependencies: useRef<HTMLDivElement>(null),
    preflight: useRef<HTMLDivElement>(null),
    submit: useRef<HTMLDivElement>(null),
  };

  // Phase 8: Rollout and status
  const [wizardAllowed, setWizardAllowed] = useState<boolean | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Phase 8: Save/resume
  const [resumeBannerVisible, setResumeBannerVisible] = useState(false);
  const [savedStep, setSavedStep] = useState<WizardStep | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Phase 8: Step timing
  const stepTimingRef = useRef<{ step: WizardStep; startTime: number } | null>(null);

  const [currentStep, setCurrentStep] = useState<WizardStep>('dependencies');
  const [entityName, setEntityName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Dependencies step state
  const [dependencyValid, setDependencyValid] = useState<boolean | null>(null);
  const [dependencyLoading, setDependencyLoading] = useState(false);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  // Preflight step state
  const [preflightScore, setPreflightScore] = useState<number | null>(null);
  const [preflightIssues, setPreflightIssues] = useState<QualityIssue[]>([]);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [preflightTimestamp, setPreflightTimestamp] = useState<number | null>(null);

  // Submit step state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Phase 8: localStorage key for save/resume
  const getStorageKey = useCallback(() => {
    if (!userId || !type || !id) return null;
    return `wizard:${userId}:${type}:${id}`;
  }, [userId, type, id]);

  // Phase 8: Save to localStorage
  const saveToLocalStorage = useCallback(() => {
    const key = getStorageKey();
    if (!key) return;

    const state = {
      step: currentStep,
      dependencyValid,
      preflightScore,
      preflightIssues,
      preflightTimestamp,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn('[wizard] Failed to save to localStorage:', error);
    }
  }, [getStorageKey, currentStep, dependencyValid, preflightScore, preflightIssues, preflightTimestamp]);

  // Phase 8: Load from localStorage
  const loadFromLocalStorage = useCallback((): Partial<{
    step: WizardStep;
    dependencyValid: boolean | null;
    preflightScore: number | null;
    preflightIssues: QualityIssue[];
    preflightTimestamp: number | null;
  }> | null => {
    const key = getStorageKey();
    if (!key) return null;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[wizard] Failed to load from localStorage:', error);
    }
    return null;
  }, [getStorageKey]);

  // Phase 8: Clear localStorage
  const clearLocalStorage = useCallback(() => {
    const key = getStorageKey();
    if (key) {
      localStorage.removeItem(key);
    }
  }, [getStorageKey]);

  // Phase 8: Save session to server
  const saveSession = useCallback(async () => {
    if (!isPublishingWizardSessionsEnabled() || !type || !id) return;

    try {
      const data = {
        dependencyValid,
        preflightScore,
        preflightIssues: preflightIssues.length,
        timestamp: Date.now(),
      };

      await apiFetch(`/api/publishing/wizard/session/${type}/${id}`, {
        method: 'POST',
        body: JSON.stringify({ step: currentStep, data }),
      });
    } catch (error) {
      console.warn('[wizard] Failed to save session:', error);
    }
  }, [isPublishingWizardSessionsEnabled, type, id, currentStep, dependencyValid, preflightScore, preflightIssues]);

  // Phase 8: Delete session from server
  const deleteSession = useCallback(async () => {
    if (!isPublishingWizardSessionsEnabled() || !type || !id) return;

    try {
      await apiFetch(`/api/publishing/wizard/session/${type}/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.warn('[wizard] Failed to delete session:', error);
    }
  }, [isPublishingWizardSessionsEnabled, type, id]);

  // Phase 8: Load wizard status (includes rollout check and session data)
  const loadWizardStatus = useCallback(async () => {
    if (!type || !id) return;

    try {
      setStatusLoading(true);
      const response = await apiFetch<{
        allowed: boolean;
        dependency_invalid: boolean;
        preflight_score: number | null;
        step?: WizardStep;
        data?: Record<string, any>;
      }>(`/api/publishing/wizard/status/${type}/${id}`);

      if (response.ok && response.data) {
        setWizardAllowed(response.data.allowed !== false);

        // Phase 8: If rollout blocked, show coming soon UI
        if (isPublishingWizardRolloutEnabled() && response.data.allowed === false) {
          return; // Will render rollout gate UI
        }

        // Phase 8: Hydrate from server session if available
        if (response.data.step && response.data.data) {
          setSavedStep(response.data.step);
          if (response.data.data.preflightScore !== undefined) {
            setPreflightScore(response.data.data.preflightScore);
          }
          setResumeBannerVisible(true);
        } else {
          // Phase 8: Try localStorage as fallback
          const localState = loadFromLocalStorage();
          if (localState && localState.step) {
            setSavedStep(localState.step);
            setResumeBannerVisible(true);
          }
        }

        // Pre-populate dependency status for worlds
        if (type === 'world') {
          setDependencyValid(true);
        }

        // Pre-populate preflight score if available
        if (response.data.preflight_score !== null) {
          setPreflightScore(response.data.preflight_score);
        }
      }
    } catch (error) {
      console.error('[wizard] Failed to load wizard status:', error);
    } finally {
      setStatusLoading(false);
    }
  }, [type, id, isPublishingWizardRolloutEnabled, loadFromLocalStorage]);

  // Phase 8: Track step timing
  const trackStepEnter = useCallback((step: WizardStep) => {
    stepTimingRef.current = { step, startTime: performance.now() };
  }, []);

  const trackStepExit = useCallback((step: WizardStep) => {
    if (stepTimingRef.current && stepTimingRef.current.step === step) {
      const duration = Math.round(performance.now() - stepTimingRef.current.startTime);
      // Emit telemetry (would need telemetry helper)
      console.log('[wizard] Step timing:', step, duration, 'ms');
      // In real implementation: emitPublishingEvent('wizard.step.timing', { step, duration, type, id, userId });
      stepTimingRef.current = null;
    }
  }, []);

  // Phase 8: Focus management on step change
  useEffect(() => {
    const ref = stepRefs[currentStep];
    if (ref.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        ref.current?.focus();
      }, 100);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isPublishingWizardEnabled()) {
      navigate('/admin');
      return;
    }

    if (!type || !id) {
      toast.error('Missing type or id parameter');
      navigate('/admin');
      return;
    }

    // Phase 8: Load wizard status (rollout check + session)
    loadWizardStatus();

    // Load entity name
    loadEntityName();

    // Phase 8: Track initial step entry
    trackStepEnter('dependencies');
  }, [type, id, loadWizardStatus, trackStepEnter, navigate]);

  // Phase 8: Auto-save on state changes
  useEffect(() => {
    if (currentStep !== 'dependencies' || dependencyValid !== null || preflightScore !== null) {
      saveToLocalStorage();
      if (isPublishingWizardSessionsEnabled()) {
        saveSession();
      }
    }
  }, [currentStep, dependencyValid, preflightScore, saveToLocalStorage, saveSession]);

  const loadEntityName = async () => {
    if (!type || !id) return;

    try {
      const tableName = type === 'story' ? 'entry_points' : `${type}s`;
      // This would need to be adapted to your actual API structure
      // For now, we'll use a placeholder
      setEntityName(`${type} ${id.substring(0, 8)}...`);
    } catch (error) {
      console.error('[wizard] Failed to load entity name:', error);
    }
  };

  const checkDependencies = useCallback(async () => {
    if (!type || !id) return;

    try {
      setDependencyLoading(true);
      setDependencyError(null);

      // For worlds, dependencies are always valid (no parent)
      if (type === 'world') {
        setDependencyValid(true);
        return;
      }

      // For stories and NPCs, check parent world
      // Use the existing isPubliclyListable logic or call a status endpoint
      const response = await apiFetch<{
        dependency_invalid: boolean;
        parent_world?: { visibility: string; review_state: string };
      }>(`/api/publishing/wizard/status/${type}/${id}`);

      if (response.ok && response.data) {
        const valid = !response.data.dependency_invalid;
        setDependencyValid(valid);
        if (!valid) {
          setDependencyError('Parent world is not public and approved');
        }
      } else {
        // If endpoint fails, show error
        setDependencyError(response.error?.message || 'Failed to check dependencies');
        setDependencyValid(false);
      }
    } catch (error) {
      console.error('[wizard] Dependency check error:', error);
      setDependencyError('Failed to check dependencies');
      setDependencyValid(false);
    } finally {
      setDependencyLoading(false);
    }
  }, [type, id]);

  const runPreflight = useCallback(async () => {
    if (!type || !id) return;

    try {
      setPreflightLoading(true);
      setPreflightError(null);

      const response = await apiFetch<{
        score: number;
        issues: QualityIssue[];
      }>(`/api/publish/${type}/${id}/preflight?persist=true&wizard=true`);

      if (response.ok && response.data) {
        setPreflightScore(response.data.score);
        setPreflightIssues(response.data.issues);
        setPreflightTimestamp(Date.now());
        // Phase 8: Save after preflight completes
        saveToLocalStorage();
        if (isPublishingWizardSessionsEnabled()) {
          saveSession();
        }
      } else {
        setPreflightError(response.error?.message || 'Failed to run preflight');
      }
    } catch (error) {
      console.error('[wizard] Preflight error:', error);
      setPreflightError('Failed to run preflight');
    } finally {
      setPreflightLoading(false);
    }
  }, [type, id, saveToLocalStorage, saveSession]);

  const submitPublishRequest = useCallback(async () => {
    if (!type || !id) return;

    try {
      setSubmitting(true);

      const response = await apiFetch<{
        code: string;
        message: string;
      }>(`/api/publish/${type}/${id}/request?wizard=true`, {
        method: 'POST',
      });

      if (response.ok && response.data) {
        setSubmitSuccess(true);
        trackStepExit('submit');
        toast.success(t('wizard.submit.success'));
        
        // Phase 8: Clear saved progress after successful submit
        clearLocalStorage();
        if (isPublishingWizardSessionsEnabled()) {
          deleteSession();
        }
        
        // Navigate after a short delay
        setTimeout(() => {
          navigate('/admin/publishing');
        }, 2000);
      } else {
        toast.error(response.error?.message || 'Failed to submit publish request');
      }
    } catch (error) {
      console.error('[wizard] Submit error:', error);
      toast.error('Failed to submit publish request');
    } finally {
      setSubmitting(false);
    }
  }, [type, id, clearLocalStorage, deleteSession, trackStepExit, t, navigate]);

  const handleNext = useCallback(() => {
    if (currentStep === 'dependencies') {
      if (dependencyValid === null) {
        checkDependencies();
        return;
      }
      if (dependencyValid) {
        trackStepExit('dependencies');
        setCurrentStep('preflight');
        trackStepEnter('preflight');
        runPreflight();
      }
    } else if (currentStep === 'preflight') {
      if (preflightScore === null) {
        runPreflight();
        return;
      }
      // Only allow proceeding if score is acceptable (≥ 60 by default)
      if (preflightScore >= 60) {
        trackStepExit('preflight');
        setCurrentStep('submit');
        trackStepEnter('submit');
      } else {
        toast.warning('Preflight score is below the recommended threshold. Please address issues before submitting.');
      }
    }
  }, [currentStep, dependencyValid, preflightScore, checkDependencies, runPreflight, trackStepExit, trackStepEnter]);

  const handleBack = () => {
    if (currentStep === 'preflight') {
      trackStepExit('preflight');
      setCurrentStep('dependencies');
      trackStepEnter('dependencies');
    } else if (currentStep === 'submit') {
      trackStepExit('submit');
      setCurrentStep('preflight');
      trackStepEnter('preflight');
    }
  };

  // Phase 8: Handle resume from saved progress
  const handleResume = () => {
    if (savedStep) {
      setCurrentStep(savedStep);
      setResumeBannerVisible(false);
      // Restore state from localStorage
      const localState = loadFromLocalStorage();
      if (localState) {
        if (localState.dependencyValid !== undefined) {
          setDependencyValid(localState.dependencyValid);
        }
        if (localState.preflightScore !== undefined) {
          setPreflightScore(localState.preflightScore);
        }
        if (localState.preflightIssues) {
          setPreflightIssues(localState.preflightIssues);
        }
        if (localState.preflightTimestamp) {
          setPreflightTimestamp(localState.preflightTimestamp);
        }
      }
    }
  };

  // Phase 8: Handle start over
  const handleStartOver = () => {
    setResumeBannerVisible(false);
    setSavedStep(null);
    clearLocalStorage();
    if (isPublishingWizardSessionsEnabled()) {
      deleteSession();
    }
    setCurrentStep('dependencies');
    setDependencyValid(null);
    setPreflightScore(null);
    setPreflightIssues([]);
    setPreflightTimestamp(null);
  };

  // Phase 8: Handle reset wizard
  const handleReset = async () => {
    handleStartOver();
    setResetDialogOpen(false);
    toast.success('Wizard reset successfully');
  };

  // Phase 8: Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to cancel/reset
      if (e.key === 'Escape' && resetDialogOpen) {
        setResetDialogOpen(false);
      }
      // Enter to advance (when button is enabled)
      if (e.key === 'Enter' && !e.shiftKey && canProceed() && currentStep !== 'submit') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canProceed, currentStep, resetDialogOpen, handleNext]);

  // Phase 8: Get error summary
  const getErrorSummary = () => {
    const errors: Array<{ step: string; message: string; anchor: string }> = [];
    if (dependencyError) {
      errors.push({ step: 'Dependencies', message: dependencyError, anchor: '#step-dependencies' });
    }
    if (preflightError) {
      errors.push({ step: 'Preflight', message: preflightError, anchor: '#step-preflight' });
    }
    return errors;
  };

  const errorSummary = getErrorSummary();

  const canProceed = useCallback(() => {
    if (currentStep === 'dependencies') {
      return dependencyValid === true;
    }
    if (currentStep === 'preflight') {
      return preflightScore !== null && preflightScore >= 60;
    }
    return false;
  }, [currentStep, dependencyValid, preflightScore]);

  const getStepProgress = () => {
    const steps: WizardStep[] = ['dependencies', 'preflight', 'submit'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  if (!isPublishingWizardEnabled() || !type || !id) {
    return null;
  }

  // Phase 8: Rollout gate - show coming soon if not allowed
  if (isPublishingWizardRolloutEnabled() && wizardAllowed === false) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('wizard.rollout.comingSoon')}</CardTitle>
            <CardDescription>{t('wizard.rollout.message')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(`/admin/${type}s/${id}`)}>
              {t('wizard.rollout.fallback')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading wizard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* Phase 8: Error Summary */}
      {errorSummary.length > 0 && (
        <Alert variant="destructive" className="mb-6" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">{t('wizard.error.summary')}</div>
            <ul className="list-disc list-inside space-y-1">
              {errorSummary.map((error, idx) => (
                <li key={idx}>
                  <a href={error.anchor} className="underline">
                    {error.step}: {error.message}
                  </a>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Phase 8: Resume Banner */}
      {resumeBannerVisible && savedStep && (
        <Alert className="mb-6" role="status" aria-live="polite">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <div className="font-medium">{t('wizard.resume.title')}</div>
              <div className="text-sm">{t('wizard.resume.message')}</div>
            </div>
            <div className="flex gap-2 ml-4">
              <Button size="sm" variant="outline" onClick={handleStartOver}>
                {t('wizard.resume.startOver')}
              </Button>
              <Button size="sm" onClick={handleResume}>
                {t('wizard.resume.resume')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            aria-label={t('wizard.nav.cancel')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('wizard.nav.cancel')}
          </Button>
          {/* Phase 8: Reset wizard button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
            aria-label={t('wizard.reset.button')}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('wizard.reset.button')}
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold" id="wizard-title">{t('wizard.title')}</h1>
          <p className="text-muted-foreground">
            {entityName || `${type} ${id.substring(0, 8)}...`}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Step {['dependencies', 'preflight', 'submit'].indexOf(currentStep) + 1} of 3</span>
          <span className="text-sm text-muted-foreground">{Math.round(getStepProgress())}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${getStepProgress()}%` }}
          />
        </div>
      </div>

      {/* Step 1: Dependencies */}
      {currentStep === 'dependencies' && (
        <Card
          id="step-dependencies"
          ref={stepRefs.dependencies}
          tabIndex={-1}
          aria-current={currentStep === 'dependencies' ? 'step' : undefined}
          role="region"
          aria-labelledby="step-dependencies-title"
        >
          <CardHeader>
            <CardTitle id="step-dependencies-title" className="flex items-center gap-2">
              {t('wizard.step.dependencies')}
              {dependencyValid === true && <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Passed" />}
              {dependencyValid === false && <XCircle className="h-5 w-5 text-red-600" aria-label="Failed" />}
            </CardTitle>
            <CardDescription>
              Verify that parent dependencies are valid
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {type === 'world' ? (
              <Alert role="status" aria-live="polite">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {t('wizard.dependencies.world.noParent')}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {dependencyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Checking dependencies...</span>
                  </div>
                ) : dependencyValid === null ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Click "Check Dependencies" to verify parent world status
                    </p>
                    <Button
                      onClick={checkDependencies}
                      disabled={dependencyLoading}
                      aria-label={t('wizard.dependencies.check')}
                    >
                      {dependencyLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                          {t('wizard.preflight.running')}
                        </>
                      ) : (
                        t('wizard.dependencies.check')
                      )}
                    </Button>
                  </div>
                ) : dependencyValid ? (
                  <Alert role="status" aria-live="polite">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {t('wizard.dependencies.valid')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive" role="alert">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {dependencyError || t('wizard.dependencies.invalid')}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preflight */}
      {currentStep === 'preflight' && (
        <Card
          id="step-preflight"
          ref={stepRefs.preflight}
          tabIndex={-1}
          aria-current={currentStep === 'preflight' ? 'step' : undefined}
          role="region"
          aria-labelledby="step-preflight-title"
        >
          <CardHeader>
            <CardTitle id="step-preflight-title" className="flex items-center gap-2">
              {t('wizard.step.preflight')}
              {preflightScore !== null && preflightScore >= 60 && (
                <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Passed" />
              )}
              {preflightScore !== null && preflightScore < 60 && (
                <AlertCircle className="h-5 w-5 text-yellow-600" aria-label="Warning" />
              )}
            </CardTitle>
            <CardDescription>
              Run quality checks before submitting for review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preflightLoading ? (
              <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                <span className="ml-2">Running preflight check...</span>
              </div>
            ) : preflightScore === null ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Click "Run Preflight" to check for quality issues
                </p>
                <Button
                  onClick={runPreflight}
                  disabled={preflightLoading}
                  aria-label={t('wizard.preflight.run')}
                >
                  {preflightLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                      {t('wizard.preflight.running')}
                    </>
                  ) : (
                    t('wizard.preflight.run')
                  )}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{t('wizard.preflight.score')}</span>
                      <Badge variant={preflightScore >= 80 ? 'default' : preflightScore >= 60 ? 'secondary' : 'destructive'}>
                        {preflightScore}/100
                      </Badge>
                    </div>
                    <Progress value={preflightScore} aria-label={`Quality score: ${preflightScore} out of 100`} />
                  </div>
                </div>

                {/* Phase 8: Show last result timestamp */}
                {preflightTimestamp && (
                  <p className="text-xs text-muted-foreground">
                    Last checked: {new Date(preflightTimestamp).toLocaleString()}
                  </p>
                )}

                {preflightIssues.length === 0 ? (
                  <Alert role="status" aria-live="polite">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {t('wizard.preflight.noIssues')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t('wizard.preflight.issues')} ({preflightIssues.length})</h4>
                    {preflightIssues.map((issue, index) => (
                      <Alert key={index} variant={issue.severity === 'high' ? 'destructive' : 'default'}>
                        <div className="flex items-start gap-2">
                          {issue.severity === 'high' ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{issue.message}</span>
                              <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'} size="sm">
                                {issue.severity}
                              </Badge>
                            </div>
                            {issue.tip && (
                              <p className="text-sm text-muted-foreground">{issue.tip}</p>
                            )}
                          </div>
                        </div>
                      </Alert>
                    ))}
                  </div>
                )}

                {preflightScore < 60 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Quality score is below the recommended threshold (60). Please address the issues above before submitting.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {preflightError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{preflightError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Submit */}
      {currentStep === 'submit' && (
        <Card
          id="step-submit"
          ref={stepRefs.submit}
          tabIndex={-1}
          aria-current={currentStep === 'submit' ? 'step' : undefined}
          role="region"
          aria-labelledby="step-submit-title"
        >
          <CardHeader>
            <CardTitle id="step-submit-title" className="flex items-center gap-2">
              {t('wizard.step.submit')}
              {submitSuccess && <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Success" />}
            </CardTitle>
            <CardDescription>
              Submit your content for admin review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitSuccess ? (
              <Alert role="status" aria-live="polite">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {t('wizard.submit.success')} Redirecting to publishing page...
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <h4 className="font-medium">{t('wizard.submit.summary')}</h4>
                  <div className="space-y-1 text-sm" role="list">
                    <div className="flex items-center gap-2" role="listitem">
                      <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                      <span>Dependencies validated</span>
                    </div>
                    <div className="flex items-center gap-2" role="listitem">
                      <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                      <span>Preflight check passed (Score: {preflightScore}/100)</span>
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Once submitted, your content will be reviewed by an admin before being published.
                  </AlertDescription>
                </Alert>

                {/* Phase 8: CTAs after submit */}
                {submitSuccess && (
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" onClick={() => navigate('/admin/publishing')}>
                      View status in Publishing
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/admin/${type}s/${id}`)}>
                      View {type}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6" role="navigation" aria-label="Wizard navigation">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 'dependencies' || submitting}
          aria-label={t('wizard.nav.back')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          {t('wizard.nav.back')}
        </Button>

        {currentStep !== 'submit' ? (
          <Button
            onClick={handleNext}
            disabled={loading || dependencyLoading || preflightLoading || !canProceed()}
            aria-label={t('wizard.nav.next')}
          >
            {t('wizard.nav.next')}
            <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            onClick={submitPublishRequest}
            disabled={submitting || submitSuccess}
            aria-label={t('wizard.submit.button')}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                {t('wizard.submit.submitting')}
              </>
            ) : submitSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                Submitted
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('wizard.submit.button')}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Phase 8: Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wizard.reset.button')}</DialogTitle>
            <DialogDescription>{t('wizard.reset.confirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

