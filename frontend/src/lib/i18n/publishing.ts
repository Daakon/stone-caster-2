/**
 * Publishing i18n hooks and centralized copy
 * Phase 8: Centralized strings for easy i18n swap later
 */

type PublishingI18nKey =
  | 'wizard.title'
  | 'wizard.step.dependencies'
  | 'wizard.step.preflight'
  | 'wizard.step.submit'
  | 'wizard.dependencies.check'
  | 'wizard.dependencies.valid'
  | 'wizard.dependencies.invalid'
  | 'wizard.dependencies.world.noParent'
  | 'wizard.preflight.run'
  | 'wizard.preflight.running'
  | 'wizard.preflight.score'
  | 'wizard.preflight.issues'
  | 'wizard.preflight.noIssues'
  | 'wizard.submit.button'
  | 'wizard.submit.submitting'
  | 'wizard.submit.success'
  | 'wizard.submit.summary'
  | 'wizard.nav.next'
  | 'wizard.nav.back'
  | 'wizard.nav.cancel'
  | 'wizard.resume.title'
  | 'wizard.resume.message'
  | 'wizard.resume.resume'
  | 'wizard.resume.startOver'
  | 'wizard.reset.button'
  | 'wizard.reset.confirm'
  | 'wizard.rollout.comingSoon'
  | 'wizard.rollout.message'
  | 'wizard.rollout.fallback'
  | 'wizard.error.summary'
  | 'wizard.error.dependencies'
  | 'wizard.error.preflight'
  | 'wizard.error.submit';

const translations: Record<PublishingI18nKey, string> = {
  'wizard.title': 'Publishing Wizard',
  'wizard.step.dependencies': 'Dependencies',
  'wizard.step.preflight': 'Preflight Check',
  'wizard.step.submit': 'Submit for Review',
  'wizard.dependencies.check': 'Check Dependencies',
  'wizard.dependencies.valid': 'Parent world is public and approved. Dependencies are valid.',
  'wizard.dependencies.invalid': 'Parent world is not public and approved. Please publish the parent world first.',
  'wizard.dependencies.world.noParent': "Worlds don't have parent dependencies. You can proceed to the next step.",
  'wizard.preflight.run': 'Run Preflight',
  'wizard.preflight.running': 'Running...',
  'wizard.preflight.score': 'Quality Score',
  'wizard.preflight.issues': 'Issues Found',
  'wizard.preflight.noIssues': 'No issues found. Your content is ready!',
  'wizard.submit.button': 'Submit for Review',
  'wizard.submit.submitting': 'Submitting...',
  'wizard.submit.success': 'Publish request submitted successfully!',
  'wizard.submit.summary': 'Review Summary',
  'wizard.nav.next': 'Next',
  'wizard.nav.back': 'Back',
  'wizard.nav.cancel': 'Cancel',
  'wizard.resume.title': 'Resume Previous Progress?',
  'wizard.resume.message': 'We found saved progress from a previous session. Would you like to resume?',
  'wizard.resume.resume': 'Resume',
  'wizard.resume.startOver': 'Start Over',
  'wizard.reset.button': 'Reset Wizard',
  'wizard.reset.confirm': 'Are you sure you want to reset? This will clear all saved progress.',
  'wizard.rollout.comingSoon': 'Coming Soon',
  'wizard.rollout.message': 'The Publishing Wizard is currently in limited rollout. Please use the standard publish flow for now.',
  'wizard.rollout.fallback': 'Use Standard Publish Flow',
  'wizard.error.summary': 'Please fix the following issues before continuing:',
  'wizard.error.dependencies': 'Dependencies check failed',
  'wizard.error.preflight': 'Preflight check failed',
  'wizard.error.submit': 'Submit failed',
};

/**
 * Translation function (placeholder for future i18n library)
 * @param key - Translation key
 * @param vars - Optional variables for interpolation
 * @returns Translated string
 */
export function t(key: PublishingI18nKey, vars?: Record<string, string | number>): string {
  let text = translations[key] || key;

  // Simple variable interpolation: {{varName}}
  if (vars) {
    Object.entries(vars).forEach(([varName, value]) => {
      text = text.replace(new RegExp(`{{${varName}}}`, 'g'), String(value));
    });
  }

  return text;
}

/**
 * Hook for React components (placeholder for future i18n library)
 */
export function usePublishingI18n() {
  return { t };
}

