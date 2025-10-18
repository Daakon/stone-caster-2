/**
 * AWF Economy Admin Routes
 * CRUD operations for economy registries
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const router = Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const ItemSchema = z.object({
  id: z.string().min(1).max(50),
  doc: z.object({
    id: z.string(),
    name: z.string(),
    cat: z.string(),
    tier: z.number().min(1).max(10),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legend']),
    stack: z.number().min(1).max(999),
    tags: z.array(z.string()),
    rules: z.object({
      use: z.any().optional(),
      equip: z.any().optional(),
    }).optional(),
  }),
  hash: z.string().min(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legend']),
  tier: z.number().min(1).max(10),
  tags: z.array(z.string()),
});

const RecipeSchema = z.object({
  id: z.string().min(1).max(50),
  doc: z.object({
    id: z.string(),
    inputs: z.array(z.object({
      id: z.string().optional(),
      tag: z.string().optional(),
      qty: z.number().min(1),
    })),
    outputs: z.array(z.object({
      id: z.string(),
      qty: z.number().min(1),
    })),
    skill: z.string(),
    diff: z.number().min(0).max(100),
    station: z.string(),
  }),
  hash: z.string().min(1),
  skill: z.string().optional(),
  difficulty: z.number().min(0).max(100),
});

const LootTableSchema = z.object({
  id: z.string().min(1).max(50),
  doc: z.object({
    id: z.string(),
    rolls: z.number().min(1).max(10),
    entries: z.array(z.object({
      id: z.string(),
      w: z.number().min(1),
      qty: z.array(z.number()).length(2),
    })),
  }),
  hash: z.string().min(1),
  scope: z.enum(['global', 'world', 'adventure', 'node', 'npc']),
  ref: z.string().min(1),
});

const VendorSchema = z.object({
  id: z.string().min(1).max(50),
  doc: z.object({
    id: z.string(),
    currency: z.string(),
    stock: z.array(z.object({
      id: z.string(),
      qty: z.number().min(0),
      price: z.number().min(0),
    })),
    buySpread: z.number().min(0).max(2),
    sellSpread: z.number().min(0).max(2),
    refresh: z.string(),
  }),
  hash: z.string().min(1),
  world_ref: z.string().min(1),
  adventure_ref: z.string().optional(),
});

// Middleware to check admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', req.user?.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify admin access' });
  }
};

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * ITEMS ROUTES
 */

// GET /api/admin/awf/economy/items
router.get('/economy/items', async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from('items_registry')
      .select('*')
      .order('id');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch items' });
    }

    res.json({ items: items || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/awf/economy/items
router.post('/economy/items', async (req, res) => {
  try {
    const itemData = ItemSchema.parse(req.body);

    const { data, error } = await supabase
      .from('items_registry')
      .insert({
        id: itemData.id,
        doc: itemData.doc,
        hash: itemData.hash,
        rarity: itemData.rarity,
        tier: itemData.tier,
        tags: itemData.tags,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create item' });
    }

    res.json({ item: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid item data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/awf/economy/items/:id
router.put('/economy/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const itemData = ItemSchema.parse(req.body);

    const { data, error } = await supabase
      .from('items_registry')
      .update({
        doc: itemData.doc,
        hash: itemData.hash,
        rarity: itemData.rarity,
        tier: itemData.tier,
        tags: itemData.tags,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update item' });
    }

    res.json({ item: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid item data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/awf/economy/items/:id
router.delete('/economy/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('items_registry')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete item' });
    }

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * RECIPES ROUTES
 */

// GET /api/admin/awf/economy/recipes
router.get('/economy/recipes', async (req, res) => {
  try {
    const { data: recipes, error } = await supabase
      .from('recipes_registry')
      .select('*')
      .order('id');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch recipes' });
    }

    res.json({ recipes: recipes || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/awf/economy/recipes
router.post('/economy/recipes', async (req, res) => {
  try {
    const recipeData = RecipeSchema.parse(req.body);

    const { data, error } = await supabase
      .from('recipes_registry')
      .insert({
        id: recipeData.id,
        doc: recipeData.doc,
        hash: recipeData.hash,
        skill: recipeData.skill,
        difficulty: recipeData.difficulty,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create recipe' });
    }

    res.json({ recipe: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid recipe data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/awf/economy/recipes/:id
router.put('/economy/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipeData = RecipeSchema.parse(req.body);

    const { data, error } = await supabase
      .from('recipes_registry')
      .update({
        doc: recipeData.doc,
        hash: recipeData.hash,
        skill: recipeData.skill,
        difficulty: recipeData.difficulty,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update recipe' });
    }

    res.json({ recipe: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid recipe data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/awf/economy/recipes/:id
router.delete('/economy/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('recipes_registry')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete recipe' });
    }

    res.json({ success: true, message: 'Recipe deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * LOOT TABLES ROUTES
 */

// GET /api/admin/awf/economy/loot
router.get('/economy/loot', async (req, res) => {
  try {
    const { data: lootTables, error } = await supabase
      .from('loot_tables')
      .select('*')
      .order('id');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch loot tables' });
    }

    res.json({ lootTables: lootTables || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/awf/economy/loot
router.post('/economy/loot', async (req, res) => {
  try {
    const lootData = LootTableSchema.parse(req.body);

    const { data, error } = await supabase
      .from('loot_tables')
      .insert({
        id: lootData.id,
        doc: lootData.doc,
        hash: lootData.hash,
        scope: lootData.scope,
        ref: lootData.ref,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create loot table' });
    }

    res.json({ lootTable: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid loot table data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/awf/economy/loot/:id
router.put('/economy/loot/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const lootData = LootTableSchema.parse(req.body);

    const { data, error } = await supabase
      .from('loot_tables')
      .update({
        doc: lootData.doc,
        hash: lootData.hash,
        scope: lootData.scope,
        ref: lootData.ref,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update loot table' });
    }

    res.json({ lootTable: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid loot table data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/awf/economy/loot/:id
router.delete('/economy/loot/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('loot_tables')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete loot table' });
    }

    res.json({ success: true, message: 'Loot table deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * VENDORS ROUTES
 */

// GET /api/admin/awf/economy/vendors
router.get('/economy/vendors', async (req, res) => {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors_registry')
      .select('*')
      .order('id');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch vendors' });
    }

    res.json({ vendors: vendors || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/awf/economy/vendors
router.post('/economy/vendors', async (req, res) => {
  try {
    const vendorData = VendorSchema.parse(req.body);

    const { data, error } = await supabase
      .from('vendors_registry')
      .insert({
        id: vendorData.id,
        doc: vendorData.doc,
        hash: vendorData.hash,
        world_ref: vendorData.world_ref,
        adventure_ref: vendorData.adventure_ref,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create vendor' });
    }

    res.json({ vendor: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid vendor data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/awf/economy/vendors/:id
router.put('/economy/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vendorData = VendorSchema.parse(req.body);

    const { data, error } = await supabase
      .from('vendors_registry')
      .update({
        doc: vendorData.doc,
        hash: vendorData.hash,
        world_ref: vendorData.world_ref,
        adventure_ref: vendorData.adventure_ref,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update vendor' });
    }

    res.json({ vendor: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid vendor data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/awf/economy/vendors/:id
router.delete('/economy/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('vendors_registry')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete vendor' });
    }

    res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


