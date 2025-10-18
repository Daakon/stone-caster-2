/**
 * AWF Output Validator
 * Phase 5: Turn Pipeline Integration - Validates AWF model output and provides repair hints
 */

export interface AwfValidationError {
  field: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface AwfValidationResult {
  isValid: boolean;
  errors: AwfValidationError[];
  repairHint?: string;
}

export interface LocaleValidationOptions {
  locale: string;
  maxChoiceLabelLength?: number;
  enforceOneLanguage?: boolean;
}

/**
 * Validate AWF output against the expected schema
 */
export function validateAwfOutput(awf: any, localeOptions?: LocaleValidationOptions): AwfValidationResult {
  const errors: AwfValidationError[] = [];

  // Check if AWF is an object
  if (!awf || typeof awf !== 'object') {
    errors.push({
      field: 'AWF',
      message: 'Output must be an object',
      expected: 'object',
      actual: typeof awf
    });
    return { isValid: false, errors, repairHint: generateRepairHint(errors) };
  }

  // Check required fields
  if (!awf.scn || typeof awf.scn !== 'string') {
    errors.push({
      field: 'AWF.scn',
      message: 'scn field is required and must be a string',
      expected: 'string',
      actual: typeof awf.scn
    });
  }

  if (!awf.txt || typeof awf.txt !== 'string') {
    errors.push({
      field: 'AWF.txt',
      message: 'txt field is required and must be a string',
      expected: 'string',
      actual: typeof awf.txt
    });
  }

  // Check optional fields with constraints
  if (awf.choices !== undefined) {
    if (!Array.isArray(awf.choices)) {
      errors.push({
        field: 'AWF.choices',
        message: 'choices must be an array',
        expected: 'array',
        actual: typeof awf.choices
      });
    } else if (awf.choices.length > 5) {
      errors.push({
        field: 'AWF.choices',
        message: 'choices array must have at most 5 items',
        expected: '<= 5',
        actual: awf.choices.length
      });
    } else {
      // Validate choice structure
      for (let i = 0; i < awf.choices.length; i++) {
        const choice = awf.choices[i];
        if (!choice || typeof choice !== 'object') {
          errors.push({
            field: `AWF.choices[${i}]`,
            message: 'Each choice must be an object',
            expected: 'object',
            actual: typeof choice
          });
        } else {
          if (!choice.id || typeof choice.id !== 'string') {
            errors.push({
              field: `AWF.choices[${i}].id`,
              message: 'Choice id is required and must be a string',
              expected: 'string',
              actual: typeof choice.id
            });
          }
          if (!choice.label || typeof choice.label !== 'string') {
            errors.push({
              field: `AWF.choices[${i}].label`,
              message: 'Choice label is required and must be a string',
              expected: 'string',
              actual: typeof choice.label
            });
          }
        }
      }
    }
  }

  if (awf.acts !== undefined) {
    if (!Array.isArray(awf.acts)) {
      errors.push({
        field: 'AWF.acts',
        message: 'acts must be an array',
        expected: 'array',
        actual: typeof awf.acts
      });
    } else if (awf.acts.length > 8) {
      errors.push({
        field: 'AWF.acts',
        message: 'acts array must have at most 8 items',
        expected: '<= 8',
        actual: awf.acts.length
      });
    } else {
      // Validate act structure
      for (let i = 0; i < awf.acts.length; i++) {
        const act = awf.acts[i];
        if (!act || typeof act !== 'object') {
          errors.push({
            field: `AWF.acts[${i}]`,
            message: 'Each act must be an object',
            expected: 'object',
            actual: typeof act
          });
        } else {
          if (!act.type || typeof act.type !== 'string') {
            errors.push({
              field: `AWF.acts[${i}].type`,
              message: 'Act type is required and must be a string',
              expected: 'string',
              actual: typeof act.type
            });
          }
          if (!act.data || typeof act.data !== 'object') {
            errors.push({
              field: `AWF.acts[${i}].data`,
              message: 'Act data is required and must be an object',
              expected: 'object',
              actual: typeof act.data
            });
          }
        }
      }
    }
  }

  if (awf.val !== undefined && awf.val !== null && typeof awf.val !== 'string') {
    errors.push({
      field: 'AWF.val',
      message: 'val must be a string if provided',
      expected: 'string',
      actual: typeof awf.val
    });
  }

  // Check for extra keys (not allowed)
  const allowedKeys = ['scn', 'txt', 'choices', 'acts', 'val'];
  const extraKeys = Object.keys(awf).filter(key => !allowedKeys.includes(key));
  if (extraKeys.length > 0) {
    errors.push({
      field: 'AWF',
      message: `Extra keys not allowed: ${extraKeys.join(', ')}`,
      expected: `only ${allowedKeys.join(', ')}`,
      actual: `also ${extraKeys.join(', ')}`
    });
  }

  // Apply locale-specific validation
  if (localeOptions && localeOptions.locale !== 'en-US') {
    const localeErrors = validateLocaleCompliance(awf, localeOptions);
    errors.push(...localeErrors);
  }

  const isValid = errors.length === 0;
  const repairHint = isValid ? undefined : generateRepairHint(errors);

  return { isValid, errors, repairHint };
}

/**
 * Generate a repair hint based on validation errors
 */
function generateRepairHint(errors: AwfValidationError[]): string {
  const hints: string[] = [];

  // Check for missing required fields
  const missingFields = errors.filter(e => e.message.includes('required'));
  if (missingFields.length > 0) {
    hints.push('Include all required fields: scn, txt');
  }

  // Check for type errors
  const typeErrors = errors.filter(e => e.message.includes('must be'));
  if (typeErrors.length > 0) {
    hints.push('Ensure correct data types: scn and txt must be strings');
  }

  // Check for array length errors
  const lengthErrors = errors.filter(e => e.message.includes('at most'));
  if (lengthErrors.length > 0) {
    hints.push('Limit array sizes: choices <= 5, acts <= 8');
  }

  // Check for extra keys
  const extraKeyErrors = errors.filter(e => e.message.includes('Extra keys'));
  if (extraKeyErrors.length > 0) {
    hints.push('Remove extra keys, only include: scn, txt, choices, acts, val');
  }

  // Check for structure errors
  const structureErrors = errors.filter(e => e.message.includes('must be an object') || e.message.includes('must be an array'));
  if (structureErrors.length > 0) {
    hints.push('Ensure proper object/array structure for choices and acts');
  }

  if (hints.length === 0) {
    return 'Output must include exactly one top-level object named AWF; include scn and txt; choices <= 5; acts <= 8; do not include extra keys.';
  }

  return hints.join('; ') + '.';
}

/**
 * Check if the output has the correct top-level structure
 */
export function hasCorrectTopLevelStructure(output: any): boolean {
  return !!(output && 
         typeof output === 'object' && 
         output.AWF && 
         typeof output.AWF === 'object');
}

/**
 * Extract AWF object from model output
 */
export function extractAwfFromOutput(output: any): any {
  if (hasCorrectTopLevelStructure(output)) {
    // Validate the AWF object has required fields
    const awf = output.AWF;
    if (typeof awf.scn === 'string' && typeof awf.txt === 'string') {
      return awf;
    }
    return null;
  }
  
  // If output is already the AWF object, validate it has required fields
  if (output && typeof output === 'object' && 'scn' in output && 'txt' in output) {
    // Check that scn and txt are actually valid (not just present)
    if (typeof output.scn === 'string' && typeof output.txt === 'string') {
      return output;
    }
  }
  
  return null;
}

/**
 * Validate locale compliance for AWF output
 * @param awf - AWF output object
 * @param options - Locale validation options
 * @returns Array of validation errors
 */
function validateLocaleCompliance(awf: any, options: LocaleValidationOptions): AwfValidationError[] {
  const errors: AwfValidationError[] = [];

  // Validate choice label lengths
  if (options.maxChoiceLabelLength && awf.choices && Array.isArray(awf.choices)) {
    for (let i = 0; i < awf.choices.length; i++) {
      const choice = awf.choices[i];
      if (choice && choice.label && typeof choice.label === 'string') {
        if (choice.label.length > options.maxChoiceLabelLength) {
          errors.push({
            field: `AWF.choices[${i}].label`,
            message: `Choice label exceeds maximum length for ${options.locale}`,
            expected: `<= ${options.maxChoiceLabelLength} characters`,
            actual: `${choice.label.length} characters`
          });
        }
      }
    }
  }

  // Validate one-language policy
  if (options.enforceOneLanguage) {
    const textFields = [awf.txt, awf.scn];
    if (awf.choices && Array.isArray(awf.choices)) {
      textFields.push(...awf.choices.map((c: any) => c.label).filter(Boolean));
    }

    for (const text of textFields) {
      if (typeof text === 'string' && containsMixedLanguages(text, options.locale)) {
        errors.push({
          field: 'AWF',
          message: `Text contains mixed languages, expected only ${options.locale}`,
          expected: `single language: ${options.locale}`,
          actual: 'mixed languages detected'
        });
        break; // Only report once
      }
    }
  }

  return errors;
}

/**
 * Check if text contains mixed languages
 * @param text - Text to check
 * @param expectedLocale - Expected locale
 * @returns True if mixed languages detected
 */
function containsMixedLanguages(text: string, expectedLocale: string): boolean {
  // Simple heuristic: check for ASCII-only English words in non-English locales
  if (expectedLocale === 'en-US') {
    return false; // English is the baseline
  }

  // Check for common English words that shouldn't appear in localized text
  const englishWords = /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall)\b/gi;
  const englishMatches = text.match(englishWords);
  
  // If we find English words in a non-English locale, it might be mixed
  if (englishMatches && englishMatches.length > 2) {
    return true;
  }

  // Check for placeholder preservation (these should be preserved)
  const placeholders = /\{[^}]+\}/g;
  const placeholderMatches = text.match(placeholders);
  
  // If text is mostly placeholders, it's probably fine
  if (placeholderMatches && placeholderMatches.length > 0) {
    const placeholderRatio = placeholderMatches.join('').length / text.length;
    if (placeholderRatio > 0.3) {
      return false; // Mostly placeholders, probably fine
    }
  }

  return false; // Default to no mixed language detection
}
