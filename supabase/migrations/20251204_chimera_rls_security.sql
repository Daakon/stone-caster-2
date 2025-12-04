-- ============================================================================
-- Phase 2: Chimera RLS Security Lockdown
-- Enable Row Level Security on all Chimera tables
-- Date: 2025-12-04
-- ============================================================================

-- ============================================================================
-- PART 1: Enable RLS on Chimera Tables
-- ============================================================================

ALTER TABLE IF EXISTS chimera_worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chimera_ruleset_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chimera_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chimera_lore ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS compiled_stories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: chimera_worlds RLS Policies
-- ============================================================================

-- Policy: Users can SELECT public worlds OR their own worlds
CREATE POLICY "chimera_worlds_select_public_or_own"
  ON chimera_worlds FOR SELECT
  USING (
    visibility = 'public' 
    OR owner_user_id = auth.uid()
  );

-- Policy: Users can INSERT their own worlds (owner_user_id must match auth.uid())
CREATE POLICY "chimera_worlds_insert_own"
  ON chimera_worlds FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- Policy: Users can UPDATE their own worlds
CREATE POLICY "chimera_worlds_update_own"
  ON chimera_worlds FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Policy: Users can DELETE their own worlds
CREATE POLICY "chimera_worlds_delete_own"
  ON chimera_worlds FOR DELETE
  USING (owner_user_id = auth.uid());

-- ============================================================================
-- PART 3: chimera_ruleset_templates RLS Policies
-- Note: Ruleset templates are system-owned (owner_user_id is NULL)
-- Users can read public/system templates, but only admins can modify
-- ============================================================================

-- Policy: Anyone can SELECT ruleset templates (they're public/system resources)
CREATE POLICY "chimera_ruleset_templates_select_all"
  ON chimera_ruleset_templates FOR SELECT
  USING (true);

-- Policy: Only authenticated users can INSERT (admin check happens in application layer)
-- For now, allow any authenticated user - admin check in middleware
CREATE POLICY "chimera_ruleset_templates_insert_authenticated"
  ON chimera_ruleset_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Only authenticated users can UPDATE (admin check in application layer)
CREATE POLICY "chimera_ruleset_templates_update_authenticated"
  ON chimera_ruleset_templates FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Only authenticated users can DELETE (admin check in application layer)
CREATE POLICY "chimera_ruleset_templates_delete_authenticated"
  ON chimera_ruleset_templates FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- PART 4: chimera_entities RLS Policies
-- Note: Entities may have owner_user_id in raw_data JSONB, but we'll use
-- a simpler approach: allow all authenticated users to read, but ownership
-- checks happen in application layer via raw_data JSONB queries
-- ============================================================================

-- Policy: Anyone can SELECT entities (they're public resources)
-- Ownership filtering happens in application layer via raw_data queries
CREATE POLICY "chimera_entities_select_all"
  ON chimera_entities FOR SELECT
  USING (true);

-- Policy: Authenticated users can INSERT entities
CREATE POLICY "chimera_entities_insert_authenticated"
  ON chimera_entities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can UPDATE entities
-- Ownership checks happen in application layer
CREATE POLICY "chimera_entities_update_authenticated"
  ON chimera_entities FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can DELETE entities
-- Ownership checks happen in application layer
CREATE POLICY "chimera_entities_delete_authenticated"
  ON chimera_entities FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- PART 5: chimera_lore RLS Policies
-- Note: Lore fragments are associated with worlds/entities
-- Ownership is determined by the associated world/entity ownership
-- For now, allow authenticated users to read/write (ownership in app layer)
-- ============================================================================

-- Policy: Authenticated users can SELECT lore fragments
-- Ownership filtering happens in application layer via fragment JSONB queries
CREATE POLICY "chimera_lore_select_authenticated"
  ON chimera_lore FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can INSERT lore fragments
CREATE POLICY "chimera_lore_insert_authenticated"
  ON chimera_lore FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can UPDATE lore fragments
-- Ownership checks happen in application layer
CREATE POLICY "chimera_lore_update_authenticated"
  ON chimera_lore FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can DELETE lore fragments
-- Ownership checks happen in application layer
CREATE POLICY "chimera_lore_delete_authenticated"
  ON chimera_lore FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- PART 6: compiled_stories RLS Policies
-- Note: compiled_stories doesn't have owner_user_id column
-- Ownership is determined by story_key association with user's stories
-- For now, allow authenticated users to read/write (ownership in app layer)
-- ============================================================================

-- Policy: Authenticated users can SELECT compiled stories
-- Ownership filtering happens in application layer via story_key association
CREATE POLICY "compiled_stories_select_authenticated"
  ON compiled_stories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can INSERT compiled stories
CREATE POLICY "compiled_stories_insert_authenticated"
  ON compiled_stories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can UPDATE compiled stories
-- Ownership checks happen in application layer
CREATE POLICY "compiled_stories_update_authenticated"
  ON compiled_stories FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can DELETE compiled stories
-- Ownership checks happen in application layer
CREATE POLICY "compiled_stories_delete_authenticated"
  ON compiled_stories FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- Summary
-- ============================================================================
-- ✅ Enabled RLS on all Chimera tables
-- ✅ Created ownership-based policies for chimera_worlds
-- ✅ Created public read policies for chimera_ruleset_templates
-- ✅ Created authenticated-only policies for chimera_entities, chimera_lore, compiled_stories
-- ✅ Application-layer ownership checks remain for entities/lore/stories (via JSONB queries)

