# Phase 17: AWF Economy Kernel Implementation

## Overview

Phase 17 introduces a deterministic, token-efficient items & economy layer for AWF: item registry, inventory & equipment, loot tables, vendors, crafting/recipes, and gold/credit balances. All mechanics remain invisible to players (narrative only) while state changes occur via acts. This provides comprehensive economy support while maintaining token efficiency.

## Features Implemented

### 1. Item Registry & Tags

**Location**: `backend/src/inventory/inventory-engine.ts`

- **Canonical Registry**: Items with compact JSON shape and hashed content
- **Categories**: weapon, armor, consumable, material, quest with rarity and tier support
- **Stacking Rules**: Configurable stack sizes and durability tracking
- **Tags System**: Categorization and filtering for items
- **Rules Engine**: Use and equip rules for items

### 2. Inventory & Equipment

**Location**: `backend/src/inventory/inventory-engine.ts`

- **Hot-State Maps**: Player and NPC inventories with deterministic capacity rules
- **Equipment Slots**: head, body, hands, offhand, amulet, ring1, ring2 with conflict resolution
- **Stack Management**: Automatic stacking with size limits and metadata
- **Capacity Rules**: Weight and slot limits with validation
- **Move Operations**: Transfer items between inventories

### 3. Loot & Vendors

**Location**: `backend/src/economy/loot-vendor-engine.ts`

- **Weighted Loot Tables**: Per node/biome/encounter with deterministic RNG
- **Vendor Inventories**: Stock management with price rules and refresh policies
- **Pricing System**: Base prices with rarity and tier factors
- **Buy/Sell Spreads**: Configurable markup and markdown rates
- **Stock Refresh**: Time-based and daily refresh policies

### 4. Crafting & Recipes

**Location**: `backend/src/crafting/crafting-engine.ts`

- **Recipe System**: Inputs (items/tags/quantities), outputs, station requirements
- **Skill Integration**: Integrates with Phase 16 Skill Check engine
- **Quality Outcomes**: Different results based on skill check outcomes
- **Bonus Items**: Critical success bonuses and failure byproducts
- **Station Requirements**: Crafting station validation

### 5. Currencies & Pricing

**Location**: `backend/src/economy/loot-vendor-engine.ts`

- **Currency Registry**: Gold, favor, shards with exchange rules
- **Price Curves**: Rarity and tier-based pricing with configurable factors
- **Vendor Pricing**: Markup/markdown with buy/sell spreads
- **Currency Management**: Delta operations with clamping

### 6. Economy Acts Integration

**Location**: `backend/src/economy/economy-acts-integration.ts`

- **Extended Acts**: ITEM_ADD, ITEM_REMOVE, ITEM_MOVE, EQUIP, UNEQUIP, LOOT_ROLL, VENDOR_BUY, VENDOR_SELL, CRAFT_ATTEMPT, CRAFT_RESULT, CURRENCY_DELTA
- **Validation**: Bounded act counts and field validation
- **Processing**: Economy acts processed in interpreter with state updates
- **Summary Generation**: Items gained/lost, currency deltas, equipment changes

### 7. Admin & Linter

**Location**: `backend/src/routes/awf-economy-admin.ts`, `backend/scripts/awf-lint-economy.ts`

- **Admin CRUD**: Items, recipes, loot tables, vendors management
- **RBAC Security**: Admin-only access with proper authentication
- **Economy Linter**: Reference validation, weight checks, price sanity
- **Comprehensive Reporting**: Errors, warnings, and suggestions

## Database Schema

### Tables Added

#### `items_registry`
```sql
CREATE TABLE items_registry (
    id TEXT PRIMARY KEY,
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legend')),
    tier INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 10),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id, hash)
);
```

#### `recipes_registry`
```sql
CREATE TABLE recipes_registry (
    id TEXT PRIMARY KEY,
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    skill TEXT,
    difficulty INTEGER DEFAULT 50 CHECK (difficulty >= 0 AND difficulty <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `loot_tables`
```sql
CREATE TABLE loot_tables (
    id TEXT PRIMARY KEY,
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'world', 'adventure', 'node', 'npc')),
    ref TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `vendors_registry`
```sql
CREATE TABLE vendors_registry (
    id TEXT PRIMARY KEY,
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    world_ref TEXT NOT NULL,
    adventure_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Game State Extensions
```sql
-- Add economy state to game_states
ALTER TABLE game_states ADD COLUMN inventory JSONB DEFAULT '{}'::jsonb;
ALTER TABLE game_states ADD COLUMN equipment JSONB DEFAULT '{}'::jsonb;
ALTER TABLE game_states ADD COLUMN currency JSONB DEFAULT '{}'::jsonb;
```

## Economy Design

### Item System

#### Item Definition
```typescript
interface ItemDefinition {
  id: string;
  name: string;
  cat: string; // weapon, armor, consumable, material, quest
  tier: number; // 1-10
  rarity: string; // common, uncommon, rare, epic, legend
  stack: number; // stack size
  tags: string[]; // categorization tags
  rules: {
    use?: any; // use rules
    equip?: {
      slot: string; // equipment slot
      [key: string]: any;
    };
    [key: string]: any;
  };
}
```

#### Item Categories
- **weapon**: Melee and ranged weapons
- **armor**: Protective equipment
- **consumable**: Potions, food, scrolls
- **material**: Crafting components
- **quest**: Quest-specific items

#### Rarity System
- **common**: Basic items, low value
- **uncommon**: Improved items, moderate value
- **rare**: High-quality items, high value
- **epic**: Exceptional items, very high value
- **legend**: Legendary items, maximum value

### Inventory System

#### Inventory Structure
```typescript
interface InventoryMap {
  [itemId: string]: {
    id: string;
    quantity: number;
    metadata?: {
      durability?: number;
      quality?: number;
      [key: string]: any;
    };
  };
}
```

#### Equipment Slots
```typescript
interface EquipmentMap {
  [slot: string]: {
    slot: string;
    itemId?: string;
    metadata?: {
      durability?: number;
      quality?: number;
      [key: string]: any;
    };
  };
}
```

#### Equipment Slot Types
- **head**: Helmets, hats, crowns
- **body**: Armor, robes, clothing
- **hands**: Gloves, gauntlets
- **main_hand**: Primary weapon
- **off_hand**: Shield, off-hand weapon
- **amulet**: Necklaces, amulets
- **ring1**: First ring slot
- **ring2**: Second ring slot

### Loot System

#### Loot Table Structure
```typescript
interface LootTable {
  id: string;
  rolls: number; // Number of rolls
  entries: Array<{
    id: string; // Item ID or 'gold'
    weight: number; // Drop weight
    quantity: [number, number]; // [min, max] quantity
  }>;
}
```

#### Loot Scopes
- **global**: Available everywhere
- **world**: World-specific loot
- **adventure**: Adventure-specific loot
- **node**: Node-specific loot
- **npc**: NPC-specific loot

### Vendor System

#### Vendor Structure
```typescript
interface Vendor {
  id: string;
  currency: string; // Primary currency
  stock: Array<{
    id: string; // Item ID
    quantity: number; // Available quantity
    price: number; // Base price
  }>;
  buySpread: number; // Buy price multiplier (0-2)
  sellSpread: number; // Sell price multiplier (0-2)
  refresh: string; // Refresh policy
}
```

#### Pricing System
```typescript
// Price calculation
const basePrice = item.basePrice;
const rarityFactor = rarityFactors[item.rarity];
const tierFactor = Math.pow(1.5, item.tier - 1);
const finalPrice = Math.ceil(basePrice * rarityFactor * tierFactor * spread);
```

### Crafting System

#### Recipe Structure
```typescript
interface Recipe {
  id: string;
  inputs: Array<{
    id?: string; // Specific item ID
    tag?: string; // Item tag
    qty: number; // Required quantity
  }>;
  outputs: Array<{
    id: string; // Output item ID
    qty: number; // Output quantity
  }>;
  skill: string; // Required skill
  diff: number; // Difficulty (0-100)
  station: string; // Required station
}
```

#### Crafting Outcomes
- **crit**: Critical success - bonus items, high quality
- **success**: Success - normal output, good quality
- **mixed**: Mixed result - reduced output, moderate quality
- **fail**: Failure - minimal output, low quality
- **critfail**: Critical failure - waste products, very low quality

## Acts System

### New Act Types

#### ITEM_ADD
```typescript
{
  type: 'ITEM_ADD';
  target: 'player' | 'npc:<id>';
  id: string;
  quantity: number;
  metadata?: any;
}
```

#### ITEM_REMOVE
```typescript
{
  type: 'ITEM_REMOVE';
  target: 'player' | 'npc:<id>';
  id: string;
  quantity: number;
}
```

#### ITEM_MOVE
```typescript
{
  type: 'ITEM_MOVE';
  from: 'player' | 'npc:<id>';
  to: 'player' | 'npc:<id>';
  id: string;
  quantity: number;
}
```

#### EQUIP
```typescript
{
  type: 'EQUIP';
  slot: string;
  id: string;
}
```

#### UNEQUIP
```typescript
{
  type: 'UNEQUIP';
  slot: string;
}
```

#### LOOT_ROLL
```typescript
{
  type: 'LOOT_ROLL';
  tableId: string;
  rolls?: number;
  nodeId?: string;
}
```

#### VENDOR_BUY
```typescript
{
  type: 'VENDOR_BUY';
  vendorId: string;
  id: string;
  quantity: number;
  currency?: string;
  totalCost?: number;
}
```

#### VENDOR_SELL
```typescript
{
  type: 'VENDOR_SELL';
  vendorId: string;
  id: string;
  quantity: number;
  currency?: string;
  totalValue?: number;
}
```

#### CRAFT_ATTEMPT
```typescript
{
  type: 'CRAFT_ATTEMPT';
  recipeId: string;
  inputs?: Array<{ id: string; qty: number }>;
  station?: string;
  skill?: string;
}
```

#### CRAFT_RESULT
```typescript
{
  type: 'CRAFT_RESULT';
  recipeId: string;
  outcome: 'crit' | 'success' | 'mixed' | 'fail' | 'critfail';
  quality: number;
  yields: Array<{ id: string; qty: number }>;
  bonus?: Array<{ id: string; qty: number }>;
  byproducts?: Array<{ id: string; qty: number }>;
}
```

#### CURRENCY_DELTA
```typescript
{
  type: 'CURRENCY_DELTA';
  key: string; // Currency type
  delta: number; // Amount to add/subtract
  clamp?: 'soft' | 'hard';
}
```

## Usage Examples

### 1. Item Management

```typescript
import { inventoryEngine } from '../inventory/inventory-engine.js';

// Add items to inventory
const result = inventoryEngine.addItems(inventory, 'itm.healing_leaf', 5);
if (result.success) {
  console.log(`Added ${result.added} healing leaves`);
}

// Remove items from inventory
const removeResult = inventoryEngine.removeItems(inventory, 'itm.healing_leaf', 2);
if (removeResult.success) {
  console.log(`Removed ${removeResult.removed} healing leaves`);
}

// Equip item
const equipResult = inventoryEngine.equipItem(inventory, equipment, 'itm.iron_sword', 'main_hand');
if (equipResult.success) {
  console.log('Sword equipped successfully');
}
```

### 2. Loot Generation

```typescript
import { lootVendorEngine } from '../economy/loot-vendor-engine.js';

// Roll loot from table
const lootResult = lootVendorEngine.rollLoot(
  'loot.glade.basic',
  'session-123',
  5,
  'glade_clearing'
);

console.log('Looted items:', lootResult.items);
console.log('Looted currency:', lootResult.currency);
```

### 3. Vendor Trading

```typescript
// Buy from vendor
const buyResult = lootVendorEngine.buyFromVendor(
  'vnd.herbalist.kiera',
  'itm.healing_leaf',
  2,
  { gold: 100 }
);

if (buyResult.success) {
  console.log(`Bought items for ${buyResult.cost} gold`);
}

// Sell to vendor
const sellResult = lootVendorEngine.sellToVendor(
  'vnd.herbalist.kiera',
  'itm.healing_leaf',
  1
);

if (sellResult.success) {
  console.log(`Sold items for ${sellResult.value} gold`);
}
```

### 4. Crafting

```typescript
import { craftingEngine } from '../crafting/crafting-engine.js';

const attempt: CraftingAttempt = {
  recipeId: 'rcp.mending_tonic',
  inputs: [
    { id: 'itm.healing_leaf', qty: 2 },
    { id: 'itm.vial', qty: 1 },
  ],
  station: 'alembic',
  skill: 'alchemy',
};

const result = craftingEngine.attemptCrafting(
  attempt,
  'session-123',
  5,
  'player'
);

console.log(`Crafting ${result.outcome}: Quality ${result.quality}`);
console.log('Yields:', result.yields);
console.log('Bonus:', result.bonus);
console.log('Byproducts:', result.byproducts);
```

### 5. Economy Acts

```typescript
import { economyActsIntegration } from '../economy/economy-acts-integration.js';

const acts: EconomyAct[] = [
  {
    type: 'LOOT_ROLL',
    tableId: 'loot.glade.basic',
    nodeId: 'glade_clearing',
  },
  {
    type: 'CRAFT_ATTEMPT',
    recipeId: 'rcp.mending_tonic',
    inputs: [
      { id: 'itm.healing_leaf', qty: 2 },
      { id: 'itm.vial', qty: 1 },
    ],
    station: 'alembic',
  },
  {
    type: 'CURRENCY_DELTA',
    key: 'gold',
    delta: 100,
  },
];

const context: EconomyContext = {
  sessionId: 'session-123',
  turnId: 5,
  actor: 'player',
  gameState: {
    inventory: { player: {}, npcs: {} },
    equipment: { player: {}, npcs: {} },
    currency: { gold: 100 },
    flags: {},
    objectives: {},
  },
};

const result = await economyActsIntegration.processEconomyActs(acts, context);
console.log('Items gained:', result.summary.itemsGained);
console.log('Currency delta:', result.summary.currencyDelta);
```

## Admin Controls

### API Endpoints

#### Items Management
```bash
# List items
GET /api/admin/awf/economy/items

# Create item
POST /api/admin/awf/economy/items
{
  "id": "itm.healing_leaf",
  "doc": {
    "id": "itm.healing_leaf",
    "name": "Healing Leaf",
    "cat": "consumable",
    "tier": 1,
    "rarity": "common",
    "stack": 10,
    "tags": ["herb", "heal"],
    "rules": {
      "use": {
        "RESOURCE_DELTA": [{"key": "hp", "delta": 10}]
      }
    }
  },
  "hash": "healing-leaf-v1",
  "rarity": "common",
  "tier": 1,
  "tags": ["herb", "heal", "consumable"]
}

# Update item
PUT /api/admin/awf/economy/items/:id

# Delete item
DELETE /api/admin/awf/economy/items/:id
```

#### Recipes Management
```bash
# List recipes
GET /api/admin/awf/economy/recipes

# Create recipe
POST /api/admin/awf/economy/recipes
{
  "id": "rcp.mending_tonic",
  "doc": {
    "id": "rcp.mending_tonic",
    "inputs": [
      {"id": "itm.healing_leaf", "qty": 2},
      {"tag": "vial", "qty": 1}
    ],
    "outputs": [
      {"id": "itm.mending_tonic", "qty": 1}
    ],
    "skill": "alchemy",
    "diff": 45,
    "station": "alembic"
  },
  "hash": "mending-tonic-recipe-v1",
  "skill": "alchemy",
  "difficulty": 45
}

# Update recipe
PUT /api/admin/awf/economy/recipes/:id

# Delete recipe
DELETE /api/admin/awf/economy/recipes/:id
```

#### Loot Tables Management
```bash
# List loot tables
GET /api/admin/awf/economy/loot

# Create loot table
POST /api/admin/awf/economy/loot
{
  "id": "loot.glade.basic",
  "doc": {
    "id": "loot.glade.basic",
    "rolls": 1,
    "entries": [
      {"id": "itm.healing_leaf", "w": 60, "qty": [1, 2]},
      {"id": "gold", "w": 40, "qty": [5, 10]}
    ]
  },
  "hash": "glade-basic-loot-v1",
  "scope": "node",
  "ref": "glade_clearing"
}

# Update loot table
PUT /api/admin/awf/economy/loot/:id

# Delete loot table
DELETE /api/admin/awf/economy/loot/:id
```

#### Vendors Management
```bash
# List vendors
GET /api/admin/awf/economy/vendors

# Create vendor
POST /api/admin/awf/economy/vendors
{
  "id": "vnd.herbalist.kiera",
  "doc": {
    "id": "vnd.herbalist.kiera",
    "currency": "gold",
    "stock": [
      {"id": "itm.healing_leaf", "qty": 5, "price": 12}
    ],
    "buySpread": 0.4,
    "sellSpread": 1.0,
    "refresh": "daily"
  },
  "hash": "kiera-herbalist-v1",
  "world_ref": "mystika",
  "adventure_ref": null
}

# Update vendor
PUT /api/admin/awf/economy/vendors/:id

# Delete vendor
DELETE /api/admin/awf/economy/vendors/:id
```

## Economy Linter

### CLI Usage
```bash
# Lint all economy
npm run awf:lint:economy lint
```

### Lint Checks
1. **Registry Validation**: Items, recipes, loot tables, vendors consistency
2. **Reference Validation**: Unknown item references, circular recipes
3. **Weight Distribution**: Loot table weight validation
4. **Price Sanity**: Vendor pricing validation
5. **Stack Validation**: Item stack size validation
6. **Category Validation**: Item category validation

### Lint Output
```
Economy Lint Results:
Valid: ❌

Errors:
  ❌ Recipe rcp.mending_tonic: references unknown item itm.healing_leaf
  ❌ Loot table loot.glade.basic: all entries have zero weight

Warnings:
  ⚠️  Item itm.healing_leaf: stack size 999 outside recommended range (1-999)
  ⚠️  Vendor vnd.herbalist.kiera: buy spread 0.4 outside recommended range (0-2)

Suggestions:
  💡 Item itm.iron_sword: consider adding tags for categorization
  💡 Loot table loot.glade.basic: very low total weight (5) may cause issues
```

## Configuration

### Environment Variables
```bash
# Inventory limits
AWF_INV_MAX_STACK=99
AWF_INV_MAX_ITEMS=120

# Economy pricing
AWF_ECON_PRICE_BASE=1.0
AWF_ECON_RARITY_FACTORS=common:1,uncommon:1.4,rare:2.0,epic:3.2,legend:5.0

# Vendor settings
AWF_VENDOR_DEFAULT_SPREAD=buy:0.4,sell:1.0

# Loot settings
AWF_LOOT_MAX_ROLLS=3

# Crafting settings
AWF_CRAFT_DEFAULT_STATION=workbench
```

## Integration with AWF Pipeline

### 1. Turn Orchestrator Integration

```typescript
// In turn orchestrator
const economyActs = [
  {
    type: 'LOOT_ROLL',
    tableId: 'loot.glade.basic',
    nodeId: 'glade_clearing',
  },
  {
    type: 'CRAFT_ATTEMPT',
    recipeId: 'rcp.mending_tonic',
    inputs: [
      { id: 'itm.healing_leaf', qty: 2 },
      { id: 'itm.vial', qty: 1 },
    ],
  },
];

const result = await economyActsIntegration.processEconomyActs(economyActs, context);

// Apply to game state
gameState.inventory = result.updatedGameState.inventory;
gameState.equipment = result.updatedGameState.equipment;
gameState.currency = result.updatedGameState.currency;
```

### 2. Bundle Assembly Integration

```typescript
// In bundle assembler
const econContext = {
  currencies: gameState.currency,
  equipment: inventoryEngine.getEquipmentSummary(gameState.equipment.player),
  inventory: inventoryEngine.getInventorySummary(gameState.inventory.player, 10),
};

// Add to AWF bundle
awfBundle.econ = econContext;
```

### 3. Time Advance Processing

```typescript
// In time advance handler
const timeAdvanceActs = [];

// Refresh vendor stock
for (const vendor of vendors) {
  if (vendor.refresh === 'daily') {
    lootVendorEngine.refreshVendorStock(vendor.id);
  }
}

// Process resource curves
const resourceActs = resourcesEngine.processResourceCurves(gameState.currency);
timeAdvanceActs.push(...resourceActs);
```

## Security & Performance

### Security
- **Admin Access**: All economy management requires admin role
- **Input Validation**: Zod schemas for all economy data
- **RBAC Enforcement**: Proper authentication and authorization
- **Audit Logging**: All economy changes logged with timestamps

### Performance
- **Deterministic RNG**: Seeded random number generation for consistency
- **Efficient Processing**: Optimized algorithms for inventory and loot operations
- **Token Budget**: Economy metadata limited to ≤ 200 tokens total
- **Caching**: Registry data cached for fast access

## Testing

### Unit Tests
- **Inventory Operations**: Add/remove/move with stacks and capacity
- **Equipment Management**: Equip/unequip conflicts and two-hand logic
- **Loot Generation**: Deterministic results and distribution validation
- **Vendor Trading**: Buy/sell operations with currency validation
- **Crafting System**: Skill check integration and outcome generation
- **Economy Acts**: Act processing and validation

### Integration Tests
- **End-to-End Flow**: Loot roll → inventory updates → crafting attempt
- **Deterministic Behavior**: Same inputs produce same outputs
- **Performance**: Efficient processing within time limits
- **Validation**: Comprehensive error handling and edge cases

### Performance Tests
- **Inventory Operations**: < 100ms for 100 operations
- **Loot Rolls**: < 100ms for 100 rolls
- **Vendor Operations**: < 50ms for 100 operations
- **Crafting Attempts**: < 200ms for 100 attempts

## Troubleshooting

### Common Issues

1. **Inventory Full**
   - Check capacity limits
   - Verify stack sizes
   - Review item definitions

2. **Crafting Failures**
   - Check recipe inputs
   - Verify skill requirements
   - Review station requirements

3. **Vendor Issues**
   - Check stock availability
   - Verify currency amounts
   - Review pricing spreads

4. **Loot Generation Issues**
   - Check loot table weights
   - Verify item references
   - Review scope settings

### Debug Commands

```bash
# Lint economy
npm run awf:lint:economy lint

# Check admin access
curl "http://localhost:3000/api/admin/awf/economy/items"

# Test inventory operations
# (Use unit tests for debugging)
```

## Future Enhancements

### Planned Features
1. **Advanced Crafting**: Multi-step recipes and quality systems
2. **Economy Analytics**: Trade patterns and market analysis
3. **Dynamic Pricing**: Supply and demand based pricing
4. **Auction System**: Player-to-player trading
5. **Guild Economy**: Shared resources and group crafting

### Scalability Considerations
1. **Registry Caching**: Redis-based caching for large registries
2. **Batch Operations**: Bulk economy operations
3. **Performance Monitoring**: Real-time economy metrics
4. **Data Archival**: Old economy data cleanup

## Conclusion

Phase 17 provides comprehensive economy support for the AWF runtime with deterministic, seeded systems that enhance gameplay variety while remaining invisible to players. The implementation is production-ready with proper security, performance, and monitoring considerations.

## Migration Notes

### Database Migration
The migration `20250127_awf_economy_kernel.sql` includes:
- All required tables and indexes
- RLS policies for admin access
- Helper functions for economy management
- Game state extensions for inventory, equipment, and currency

### Backward Compatibility
- No changes to existing AWF pipeline
- Economy system is opt-in per adventure
- All existing functionality preserved
- Graceful degradation when economy data unavailable

### Rollback Plan
1. Stop all economy processing
2. Run down migration to remove tables
3. Remove economy integration code
4. Clean up analytics metrics


