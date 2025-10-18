-- Phase 12: AWF Localization Support
-- Migration: 20250121_awf_localization.sql

-- Add locale column to sessions table (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'locale'
    ) THEN
        ALTER TABLE sessions ADD COLUMN locale TEXT DEFAULT 'en-US' NOT NULL;
    END IF;
END $$;

-- Create localization_packs table
CREATE TABLE IF NOT EXISTS localization_packs (
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

-- Create translation_cache table
CREATE TABLE IF NOT EXISTS translation_cache (
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

-- Create localization_glossary table
CREATE TABLE IF NOT EXISTS localization_glossary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locale TEXT NOT NULL,
    entries JSONB NOT NULL DEFAULT '[]'::jsonb,
    hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(locale)
);

-- Create localization_rules table
CREATE TABLE IF NOT EXISTS localization_rules (
    locale TEXT PRIMARY KEY,
    policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_localization_packs_doc_ref ON localization_packs(doc_ref);
CREATE INDEX IF NOT EXISTS idx_localization_packs_locale ON localization_packs(locale);
CREATE INDEX IF NOT EXISTS idx_translation_cache_src_hash ON translation_cache(src_hash);
CREATE INDEX IF NOT EXISTS idx_translation_cache_langs ON translation_cache(src_lang, dst_lang);
CREATE INDEX IF NOT EXISTS idx_translation_cache_contract ON translation_cache(contract_ver);

-- Add RLS policies
ALTER TABLE localization_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE localization_glossary ENABLE ROW LEVEL SECURITY;
ALTER TABLE localization_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for localization_packs (admin only)
DROP POLICY IF EXISTS "Admin can manage localization packs" ON localization_packs;
CREATE POLICY "Admin can manage localization packs" ON localization_packs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- RLS policies for translation_cache (read-only for authenticated users)
DROP POLICY IF EXISTS "Authenticated users can read translation cache" ON translation_cache;
DROP POLICY IF EXISTS "Admin can manage translation cache" ON translation_cache;

CREATE POLICY "Authenticated users can read translation cache" ON translation_cache
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage translation cache" ON translation_cache
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- RLS policies for localization_glossary (admin only)
DROP POLICY IF EXISTS "Admin can manage localization glossary" ON localization_glossary;
CREATE POLICY "Admin can manage localization glossary" ON localization_glossary
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- RLS policies for localization_rules (admin only)
DROP POLICY IF EXISTS "Admin can manage localization rules" ON localization_rules;
CREATE POLICY "Admin can manage localization rules" ON localization_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Insert default localization rules for supported locales (idempotent)
INSERT INTO localization_rules (locale, policy) VALUES 
('en-US', '{"sentence_caps": 120, "choice_label_max": 48, "forbidden_phrases": [], "formal_you": false}'),
('fr-FR', '{"sentence_caps": 140, "choice_label_max": 48, "forbidden_phrases": [], "formal_you": true}'),
('es-ES', '{"sentence_caps": 130, "choice_label_max": 48, "forbidden_phrases": [], "formal_you": true}')
ON CONFLICT (locale) DO NOTHING;

-- Insert default glossaries (idempotent)
INSERT INTO localization_glossary (locale, entries, hash) VALUES 
('en-US', '[]'::jsonb, 'default-en'),
('fr-FR', '[]'::jsonb, 'default-fr'),
('es-ES', '[]'::jsonb, 'default-es')
ON CONFLICT (locale) DO NOTHING;

-- Add comments
COMMENT ON TABLE localization_packs IS 'Stores localized overlays for AWF documents';
COMMENT ON TABLE translation_cache IS 'Caches model-generated translations for deterministic behavior';
COMMENT ON TABLE localization_glossary IS 'Stores translation glossaries and preferred terms';
COMMENT ON TABLE localization_rules IS 'Stores localization rules and policies per locale';
