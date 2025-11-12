-- Prompt Snapshots Migration
-- Stores raw prompt snapshots for debugging and manual override

CREATE TABLE IF NOT EXISTS prompt_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id uuid NOT NULL DEFAULT gen_random_uuid(),
    templates_version text,
    pack_versions jsonb DEFAULT '{}',
    tp jsonb NOT NULL,
    linearized_prompt_text text NOT NULL,
    awf_contract text NOT NULL DEFAULT 'awf.v1',
    source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    game_id uuid REFERENCES games(id) ON DELETE SET NULL,
    turn_id bigint REFERENCES turns(id) ON DELETE SET NULL,
    CONSTRAINT uk_prompt_snapshots_snapshot_id UNIQUE (snapshot_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_created_at ON prompt_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_game_id ON prompt_snapshots(game_id);
CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_turn_id ON prompt_snapshots(turn_id);
CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_source ON prompt_snapshots(source);
CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_created_by ON prompt_snapshots(created_by);

-- RLS policies
ALTER TABLE prompt_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin users can read all snapshots
CREATE POLICY "Admin can read all prompt snapshots"
    ON prompt_snapshots
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admin users can insert snapshots
CREATE POLICY "Admin can insert prompt snapshots"
    ON prompt_snapshots
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admin users can update snapshots
CREATE POLICY "Admin can update prompt snapshots"
    ON prompt_snapshots
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role can manage prompt snapshots"
    ON prompt_snapshots
    FOR ALL
    USING (auth.role() = 'service_role');

