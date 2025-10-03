-- Stones Economy Schema for Layer 0.6
-- Creates tables for wallet management, stone ledger, and purchasable packs

-- Create stone_packs table for purchasable packs (must be created first due to foreign key references)
CREATE TABLE IF NOT EXISTS stone_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  stones_shard INTEGER NOT NULL DEFAULT 0 CHECK (stones_shard >= 0),
  stones_crystal INTEGER NOT NULL DEFAULT 0 CHECK (stones_crystal >= 0),
  stones_relic INTEGER NOT NULL DEFAULT 0 CHECK (stones_relic >= 0),
  bonus_shard INTEGER NOT NULL DEFAULT 0 CHECK (bonus_shard >= 0),
  bonus_crystal INTEGER NOT NULL DEFAULT 0 CHECK (bonus_crystal >= 0),
  bonus_relic INTEGER NOT NULL DEFAULT 0 CHECK (bonus_relic >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create stone_wallets table
CREATE TABLE IF NOT EXISTS stone_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  casting_stones INTEGER NOT NULL DEFAULT 0 CHECK (casting_stones >= 0),
  inventory_shard INTEGER NOT NULL DEFAULT 0 CHECK (inventory_shard >= 0),
  inventory_crystal INTEGER NOT NULL DEFAULT 0 CHECK (inventory_crystal >= 0),
  inventory_relic INTEGER NOT NULL DEFAULT 0 CHECK (inventory_relic >= 0),
  daily_regen INTEGER NOT NULL DEFAULT 0 CHECK (daily_regen >= 0),
  last_regen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create stone_ledger table for immutable transaction records
CREATE TABLE IF NOT EXISTS stone_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES stone_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('convert', 'purchase', 'spend', 'regen', 'admin_adjust')),
  delta_casting_stones INTEGER NOT NULL DEFAULT 0,
  delta_inventory_shard INTEGER NOT NULL DEFAULT 0,
  delta_inventory_crystal INTEGER NOT NULL DEFAULT 0,
  delta_inventory_relic INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  pack_id UUID REFERENCES stone_packs(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create payment_sessions table for tracking purchase sessions
CREATE TABLE IF NOT EXISTS payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES stone_packs(id) ON DELETE RESTRICT,
  session_id TEXT NOT NULL UNIQUE, -- Stripe session ID
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_stone_wallets_user_id ON stone_wallets(user_id);
CREATE INDEX idx_stone_ledger_wallet_id ON stone_ledger(wallet_id);
CREATE INDEX idx_stone_ledger_user_id ON stone_ledger(user_id);
CREATE INDEX idx_stone_ledger_created_at ON stone_ledger(created_at DESC);
CREATE INDEX idx_stone_packs_active ON stone_packs(is_active) WHERE is_active = true;
CREATE INDEX idx_stone_packs_sort_order ON stone_packs(sort_order);
CREATE INDEX idx_payment_sessions_user_id ON payment_sessions(user_id);
CREATE INDEX idx_payment_sessions_session_id ON payment_sessions(session_id);
CREATE INDEX idx_payment_sessions_status ON payment_sessions(status);

-- Enable Row Level Security
ALTER TABLE stone_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE stone_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE stone_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stone_wallets
CREATE POLICY "Users can view their own wallet"
  ON stone_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
  ON stone_wallets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets for users"
  ON stone_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for stone_ledger
CREATE POLICY "Users can view their own ledger entries"
  ON stone_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert ledger entries"
  ON stone_ledger FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for stone_packs (public read)
CREATE POLICY "Anyone can view active stone packs"
  ON stone_packs FOR SELECT
  USING (is_active = true);

-- RLS Policies for payment_sessions
CREATE POLICY "Users can view their own payment sessions"
  ON payment_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert payment sessions"
  ON payment_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update payment sessions"
  ON payment_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_stone_wallets_updated_at
  BEFORE UPDATE ON stone_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stone_packs_updated_at
  BEFORE UPDATE ON stone_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_sessions_updated_at
  BEFORE UPDATE ON payment_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default stone packs
INSERT INTO stone_packs (name, description, price_cents, currency, stones_shard, stones_crystal, stones_relic, bonus_shard, bonus_crystal, bonus_relic, is_active, sort_order) VALUES
(
  'Starter Pack',
  'Perfect for new adventurers to get started',
  999, -- $9.99
  'USD',
  100,
  50,
  10,
  10,
  5,
  1,
  true,
  1
),
(
  'Adventurer Pack',
  'Great value for regular players',
  1999, -- $19.99
  'USD',
  250,
  125,
  25,
  25,
  12,
  2,
  true,
  2
),
(
  'Hero Pack',
  'For serious adventurers who need more stones',
  4999, -- $49.99
  'USD',
  750,
  375,
  75,
  75,
  37,
  7,
  true,
  3
),
(
  'Legend Pack',
  'The ultimate pack for legendary adventures',
  9999, -- $99.99
  'USD',
  2000,
  1000,
  200,
  200,
  100,
  20,
  true,
  4
);

-- Update pricing config with stone packs
INSERT INTO pricing_config (key, value)
VALUES
  ('stone_packs', '{"value": [
    {
      "id": "starter",
      "name": "Starter Pack",
      "description": "Perfect for new adventurers to get started",
      "price": 999,
      "currency": "USD",
      "stones": {"shard": 100, "crystal": 50, "relic": 10},
      "bonus": {"shard": 10, "crystal": 5, "relic": 1}
    },
    {
      "id": "adventurer",
      "name": "Adventurer Pack", 
      "description": "Great value for regular players",
      "price": 1999,
      "currency": "USD",
      "stones": {"shard": 250, "crystal": 125, "relic": 25},
      "bonus": {"shard": 25, "crystal": 12, "relic": 2}
    },
    {
      "id": "hero",
      "name": "Hero Pack",
      "description": "For serious adventurers who need more stones",
      "price": 4999,
      "currency": "USD", 
      "stones": {"shard": 750, "crystal": 375, "relic": 75},
      "bonus": {"shard": 75, "crystal": 37, "relic": 7}
    },
    {
      "id": "legend",
      "name": "Legend Pack",
      "description": "The ultimate pack for legendary adventures",
      "price": 9999,
      "currency": "USD",
      "stones": {"shard": 2000, "crystal": 1000, "relic": 200},
      "bonus": {"shard": 200, "crystal": 100, "relic": 20}
    }
  ]}')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
