-- Create chimera_ruleset_templates table for Project Chimera (V2) engine
-- Phase 1: Admin-only CRUD interface for managing ruleset templates

BEGIN;

-- Create enum type for rule_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'chimera_rule_type'
  ) THEN
    CREATE TYPE public.chimera_rule_type AS ENUM ('MAIN_SYSTEM', 'SUBSYSTEM', 'MODIFIER');
  END IF;
END
$$;

-- Create chimera_ruleset_templates table
CREATE TABLE IF NOT EXISTS public.chimera_ruleset_templates (
    id text PRIMARY KEY,
    display_name text NOT NULL,
    description_short text,
    description_long text,
    version integer NOT NULL DEFAULT 1,
    rule_type public.chimera_rule_type NOT NULL,
    main_system_dependency text NULL,
    exclusion_group text NULL,
    rule_category text NOT NULL,
    definition jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_ruleset_templates_id UNIQUE (id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_rule_type 
  ON public.chimera_ruleset_templates(rule_type);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_rule_category 
  ON public.chimera_ruleset_templates(rule_category);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_main_system_dependency 
  ON public.chimera_ruleset_templates(main_system_dependency) 
  WHERE main_system_dependency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_exclusion_group 
  ON public.chimera_ruleset_templates(exclusion_group) 
  WHERE exclusion_group IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE public.chimera_ruleset_templates IS 
  'Ruleset templates for Project Chimera (V2) engine. Admin-only CRUD interface.';
COMMENT ON COLUMN public.chimera_ruleset_templates.rule_type IS 
  'Type of rule: MAIN_SYSTEM, SUBSYSTEM, or MODIFIER';
COMMENT ON COLUMN public.chimera_ruleset_templates.main_system_dependency IS 
  'Reference to a MAIN_SYSTEM rule that this SUBSYSTEM or MODIFIER depends on';
COMMENT ON COLUMN public.chimera_ruleset_templates.exclusion_group IS 
  'Rules in the same exclusion group cannot be active simultaneously';

COMMIT;

