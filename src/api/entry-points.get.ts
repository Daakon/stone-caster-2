// GET /api/entry-points
// Public browse/search endpoint with RLS enforcement

import { createClient } from '@supabase/supabase-js';
import { searchEntryPoints } from '../services/search';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client with user context
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration missing' });
    }

    // Create Supabase client (RLS will be enforced based on user context)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });

    // Parse query parameters
    const {
      query,
      world_id,
      type,
      tags,
      limit = '20',
      cursor
    } = req.query;

    // Validate and parse parameters
    const filters = {
      query: query as string | undefined,
      worldId: world_id as string | undefined,
      type: type ? (type as string).split(',') : undefined,
      tags: tags ? (tags as string).split(',') : undefined,
      limit: Math.min(parseInt(limit as string) || 20, 100),
      cursor: cursor as string | undefined
    };

    // Search entry points
    const results = await searchEntryPoints(filters, supabase);

    return res.status(200).json(results);
  } catch (error) {
    console.error('Entry points search error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to search entry points'
    });
  }
}
