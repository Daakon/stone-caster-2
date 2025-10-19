# Phase 12 — Multilingual Support for AWF Runtime

## Overview

Phase 12 adds comprehensive multilingual support to the AWF runtime, enabling locale-aware AWF generation, content localization, deterministic translation caching, and admin tooling for localization quality control. All changes remain behind existing feature flags and do not alter player-facing UI.

## Objectives

- **Locale-aware AWF generation**: Pass locale through sessions and into `awf_bundle.meta.locale`
- **Content localization**: Store per-locale text overlays for core/world/adventure/start documents
- **Deterministic translation caching**: Cache model-generated translations for consistent behavior
- **Admin tooling**: Import/export locale packs, lint for quality, and CI integration

## Implementation

### 1. Database Schema

#### New Tables

```sql
-- Add locale column to sessions
ALTER TABLE awf_sessions ADD COLUMN locale TEXT DEFAULT 'en-US' NOT NULL;

-- Localization packs for document overlays
CREATE TABLE localization_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type TEXT NOT NULL CHECK (doc_type IN ('core', 'world', 'adventure', 'start')),
    doc_ref TEXT NOT NULL,
    locale TEXT NOT NULL,
    payload JSONB NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(doc_ref, locale)
);

-- Translation cache for deterministic behavior
CREATE TABLE translation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    src_lang TEXT NOT NULL,
    dst_lang TEXT NOT NULL,
    src_hash TEXT NOT NULL,
    contract_ver TEXT NOT NULL,
    text_out TEXT NOT NULL,
    tokens_est INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(src_hash, src_lang, dst_lang, contract_ver)
);

-- Localization glossary for preferred terms
CREATE TABLE localization_glossary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locale TEXT NOT NULL,
    entries JSONB NOT NULL DEFAULT '[]'::jsonb,
    hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(locale)
);

-- Localization rules per locale
CREATE TABLE localization_rules (
    locale TEXT PRIMARY KEY,
    policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Locale Propagation

#### Session Updates
- Added `locale` column to `awf_sessions` table (default: 'en-US')
- Updated `SessionRecord` type to include locale field
- Locale flows from session into `awf_bundle.meta.locale`

#### System Prompt Enhancement
```typescript
export function createLocaleAwareSystemPrompt(locale: string, includeTools: boolean = false): string {
  const basePrompt = includeTools ? SYSTEM_AWF_RUNTIME_WITH_TOOLS : SYSTEM_AWF_RUNTIME;
  
  if (locale === 'en-US') {
    return basePrompt;
  }
  
  const localeInstruction = `Write all natural language in ${locale}. Do not mix languages. Use second-person.`;
  
  return `${basePrompt}\n\n${localeInstruction}`;
}
```

### 3. Localization Overlay System

#### LocalizationOverlayService
- **`applyLocalizedOverlays()`**: Merges locale-specific overlays into base documents
- **`getLocalizationPack()`**: Retrieves localization pack for document and locale
- **`upsertLocalizationPack()`**: Creates or updates localization packs
- **Slice-level granularity**: Only includes relevant localized fields to keep tokens low

#### Overlay Structure
```json
{
  "title": "Localized Title",
  "short_desc": "Localized Description",
  "npcs": {
    "npc1": {
      "name": "Localized Name",
      "description": "Localized Description",
      "role": "Localized Role"
    }
  },
  "locations": {
    "loc1": {
      "name": "Localized Location Name",
      "description": "Localized Location Description"
    }
  },
  "objectives": {
    "obj1": {
      "title": "Localized Objective Title",
      "description": "Localized Objective Description"
    }
  }
}
```

### 4. Translation Cache Service

#### TranslationCacheService
- **`translateText()`**: Translates text with caching and policy enforcement
- **Cache-first retrieval**: Checks cache before model translation
- **Token budget integration**: Respects `AWF_TRANSLATION_MAX_TOKENS` limit
- **Policy enforcement**: Applies locale-specific rules (sentence caps, forbidden phrases)

#### Cache Key Format
```
translation_cache: {src_hash}:{src_lang}:{dst_lang}:{contract_ver}
```

#### Translation Policy
```typescript
interface TranslationPolicy {
  sentence_caps: number;        // Maximum sentence length
  choice_label_max: number;     // Maximum choice label length
  forbidden_phrases: string[]; // Phrases to avoid
  formal_you: boolean;         // Use formal "you" (vous/usted)
}
```

### 5. Enhanced AWF Validator

#### Locale Enforcement
- **Choice label length validation**: Enforces locale-specific length limits
- **Mixed language detection**: Detects English words in non-English locales
- **One-language policy**: Ensures consistent language usage

#### Validation Options
```typescript
interface LocaleValidationOptions {
  locale: string;
  maxChoiceLabelLength?: number;
  enforceOneLanguage?: boolean;
}
```

### 6. Admin Endpoints

#### Localization Management
- **`GET/POST /api/admin/awf/localization/packs`**: CRUD operations for localization packs
- **`POST /api/admin/awf/localization/packs/import`**: Import from JSON/XLIFF
- **`GET /api/admin/awf/localization/packs/export`**: Export to JSON/XLIFF
- **`GET/POST /api/admin/awf/localization/glossary`**: Manage translation glossaries
- **`GET/POST /api/admin/awf/localization/rules`**: Manage locale-specific rules

#### Import/Export Formats

**JSON Format:**
```json
{
  "doc_ref": "adv.whispercross.v1",
  "locale": "fr-FR",
  "overlays": {
    "title": "Murmure de la Croix",
    "npcs": {
      "kiera": {
        "name": "Kiera"
      }
    }
  }
}
```

**XLIFF Format:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="adv.whispercross.v1" source-language="en-US" target-language="fr-FR">
    <body>
      <trans-unit id="title">
        <source>Whisper Cross</source>
        <target>Murmure de la Croix</target>
      </trans-unit>
    </body>
  </file>
</xliff>
```

### 7. i18n Linter

#### AWFI18nLinter
- **Placeholder integrity**: Ensures `{npc}`, `{location}`, `{objective}` are preserved
- **Sentence length bounds**: Validates against locale-specific limits
- **Mixed language detection**: Identifies English words in localized content
- **Mechanics leakage detection**: Prevents game mechanics terms in localized strings
- **Glossary conformity**: Warns on near-miss glossary violations

#### CLI Usage
```bash
# Lint French localization files
npm run awf:lint:i18n --locale fr-FR --paths "**/*fr*.json"

# Lint all locales in strict mode
npm run awf:lint:i18n --all-locales --strict

# Lint specific files with custom output
npm run awf:lint:i18n --locale es-ES --output custom-report.json file1.json file2.json
```

#### Lint Checks
1. **Placeholder Integrity**: `{npc}`, `{location}`, `{objective}` preserved
2. **Sentence Length**: Enforces locale-specific caps (fr-FR: 140, es-ES: 130)
3. **Mixed Language**: Detects English words in non-English locales
4. **Mechanics Leakage**: Prevents `tick`, `band`, `TIME_ADVANCE` in localized strings
5. **Glossary Conformity**: Warns on near-miss preferred terms

### 8. Configuration Variables

```bash
# Default Locale
DEFAULT_LOCALE=en-US

# Supported Locales
SUPPORTED_LOCALES=en-US,fr-FR,es-ES

# Translation Settings
USE_MODEL_TRANSLATOR=false
AWF_TRANSLATION_MAX_TOKENS=800

# i18n Quality Control
AWF_I18N_GLOSSARY_ENFORCE=warn  # warn|error|off
```

## Usage Examples

### 1. Creating Localization Pack

```typescript
const pack = await localizationOverlayService.upsertLocalizationPack(
  'world',
  'mystika.v1',
  'fr-FR',
  {
    title: 'Mystika',
    short_desc: 'Un monde de magie et de mystère',
    npcs: {
      'kiera': {
        name: 'Kiera',
        description: 'Une mage experte'
      }
    }
  }
);
```

### 2. Applying Localized Overlays

```typescript
const localizedDoc = await localizationOverlayService.applyLocalizedOverlays(
  baseWorldDoc,
  'world',
  'mystika.v1',
  'fr-FR',
  ['kiera', 'guard'] // Only these slices
);
```

### 3. Translation with Caching

```typescript
const result = await translationCacheService.translateText(
  'Hello world',
  'en-US',
  'fr-FR',
  {
    sentence_caps: 140,
    choice_label_max: 48,
    forbidden_phrases: [],
    formal_you: true
  }
);
```

### 4. Locale-Aware Validation

```typescript
const result = validateAwfOutput(awf, {
  locale: 'fr-FR',
  maxChoiceLabelLength: 48,
  enforceOneLanguage: true
});
```

## Observability

### Metrics
- **Translation cache hit ratio**: `awf.translation.cache.hit_ratio`
- **Translation tokens used**: `awf.translation.tokens_used`
- **Localization pack usage**: `awf.localization.pack.usage`
- **Lint violations**: `awf.lint.violations.count`

### Logging
- Per-turn locale information in structured logs
- Translation cache hits/misses
- Localization overlay applications
- Lint violations and warnings

## Security Considerations

### RLS Policies
- Localization packs: Admin-only access
- Translation cache: Read-only for authenticated users, admin for management
- Glossary and rules: Admin-only access

### Data Protection
- No PII in translation cache
- Localized content follows same security as base documents
- Audit logging for all admin localization actions

## Testing

### Unit Tests
- Locale propagation through session and bundle
- Localization overlay application and merging
- Translation cache hit/miss scenarios
- AWF validator locale enforcement
- i18n linter rule detection

### Integration Tests
- Complete localization workflow (locale → overlay → validation)
- Translation cache integration with model provider
- Admin endpoint CRUD operations
- Linter CLI functionality

### End-to-End Tests
- Turn processing with non-English locales
- Localized content display in player UI
- Translation quality and consistency
- Performance impact of localization

## Migration Guide

### 1. Database Migration
```bash
# Apply localization schema
supabase db reset --force
```

### 2. Environment Configuration
```bash
# Add to .env
DEFAULT_LOCALE=en-US
SUPPORTED_LOCALES=en-US,fr-FR,es-ES
USE_MODEL_TRANSLATOR=false
AWF_TRANSLATION_MAX_TOKENS=800
```

### 3. Admin Setup
```bash
# Create default localization rules
curl -X POST /api/admin/awf/localization/rules \
  -d '{"locale": "fr-FR", "policy": {"sentence_caps": 140, "formal_you": true}}'
```

### 4. Content Localization
```bash
# Import existing localization packs
npm run awf:lint:i18n --locale fr-FR --paths "localization/*.json"
```

## Troubleshooting

### Common Issues

1. **Missing Localization Packs**
   - Check database for `localization_packs` entries
   - Verify `doc_ref` and `locale` match session requirements

2. **Translation Cache Misses**
   - Verify `USE_MODEL_TRANSLATOR=true` for model translation
   - Check model provider configuration
   - Review token budget limits

3. **Lint Violations**
   - Run `npm run awf:lint:i18n --locale <locale>` to identify issues
   - Check placeholder preservation in localized content
   - Verify sentence length compliance

4. **Performance Issues**
   - Monitor translation cache hit ratios
   - Review localization overlay complexity
   - Check token budget usage

### Debug Commands
```bash
# Check localization pack status
curl /api/admin/awf/localization/packs?doc_type=world&locale=fr-FR

# View translation cache statistics
curl /api/admin/awf/localization/translation-stats?src_lang=en-US&dst_lang=fr-FR

# Run comprehensive i18n lint
npm run awf:lint:i18n --all-locales --strict
```

## Future Enhancements

1. **Advanced Translation Models**: Support for specialized translation models
2. **Real-time Localization**: Live translation during gameplay
3. **Cultural Adaptation**: Locale-specific cultural context
4. **Voice Localization**: Audio content localization
5. **A/B Testing**: Locale-specific content variations

## Conclusion

Phase 12 provides comprehensive multilingual support for the AWF runtime while maintaining backward compatibility and performance. The implementation includes locale-aware generation, content localization, deterministic translation caching, and quality control tooling, enabling full internationalization of the AWF system.


