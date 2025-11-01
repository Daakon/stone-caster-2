/**
 * Phase 3.2: Ephemeral Test Transaction Middleware
 * 
 * Enables running integration tests against production DB without affecting real data.
 * When X-Test-Rollback: 1 header is present and TEST_TX_ENABLED=true, all DB writes
 * in the request are wrapped in a transaction that rolls back at the end.
 * 
 * Safety: Only activates when both TEST_TX_ENABLED=true AND header present.
 */

import { Request, Response, NextFunction } from 'express';
import { Pool, Client } from 'pg';

// Extend Request type to include transaction client
declare global {
  namespace Express {
    interface Request {
      ctx?: {
        userId?: string;
        isGuest?: boolean;
        user?: any;
        dbTxClient?: Client; // Transaction client for test mode
      };
      testTx?: boolean; // Flag indicating test transaction is active
    }
  }
}

// Create a singleton connection pool for test transactions
let testTxPool: Pool | null = null;

/**
 * Get or create the test transaction pool
 * Uses direct PostgreSQL connection (not Supabase PostgREST)
 */
function getTestTxPool(): Pool {
  if (!testTxPool) {
    const { config } = require('../config/index.js');
    const supabaseUrl = config.supabase.url;
    
    // Extract PostgreSQL connection details from Supabase URL
    // Format: https://project-ref.supabase.co -> postgresql://postgres:[password]@db.project-ref.supabase.co:5432/postgres
    // For test mode, we construct a direct connection string
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    
    if (!dbUrl) {
      throw new Error('DATABASE_URL or SUPABASE_DB_URL must be set for test transactions');
    }

    testTxPool = new Pool({
      connectionString: dbUrl,
      max: 5, // Small pool for test transactions only
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000, // 10s timeout for statements in test mode
    });
  }
  
  return testTxPool;
}

/**
 * Test transaction middleware
 * 
 * Behavior:
 * - Only activates when TEST_TX_ENABLED=true AND X-Test-Rollback: 1 header present
 * - Starts a PostgreSQL transaction
 * - Stores client in req.ctx.dbTxClient
 * - Always rolls back in finally block
 * - Logs transaction begin/rollback
 */
export async function testTxMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const testTxEnabled = process.env.TEST_TX_ENABLED === 'true';
  const testRollbackHeader = req.headers['x-test-rollback'] === '1';
  
  // Safety guard: require both flag and header
  if (!testTxEnabled || !testRollbackHeader) {
    return next();
  }

  // Initialize ctx if not present
  if (!req.ctx) {
    req.ctx = {};
  }

  let txClient: Client | null = null;
  const route = req.route?.path || req.path;
  const method = req.method;

  // Log transaction begin
  console.log(JSON.stringify({
    event: 'test.tx.begin',
    route,
    method,
    txMode: 'ephemeral',
    traceId: req.traceId,
  }));

  // Rollback helper function
  const rollbackTransaction = async () => {
    if (!txClient) return;
    
    try {
      await txClient.query('ROLLBACK');
      console.log(JSON.stringify({
        event: 'test.tx.rollback',
        route,
        method,
        traceId: req.traceId,
      }));
    } catch (err) {
      console.error('[TEST_TX] Rollback error:', err);
    } finally {
      // Always release client, even if rollback failed
      txClient.release();
      req.ctx!.dbTxClient = undefined;
      req.testTx = false;
      txClient = null;
    }
  };

  try {
    // Create a dedicated client for this transaction
    const pool = getTestTxPool();
    txClient = await pool.connect();
    req.ctx!.dbTxClient = txClient;
    req.testTx = true;

    // Start transaction with timeout guards
    await txClient.query('BEGIN');
    // Set transaction-level timeouts to avoid dangling transactions
    await txClient.query('SET LOCAL statement_timeout = 10000'); // 10s statement timeout
    await txClient.query('SET LOCAL idle_in_transaction_session_timeout = 10000'); // 10s idle timeout

    // Use res.on('finish') for robustness (triggers after response sent)
    // Also listen to 'close' as fallback for early termination
    let rollbackScheduled = false;
    const scheduleRollback = () => {
      if (!rollbackScheduled) {
        rollbackScheduled = true;
        // Rollback asynchronously (don't block response)
        rollbackTransaction().catch(err => {
          console.error('[TEST_TX] Rollback scheduling error:', err);
        });
      }
    };

    res.once('finish', scheduleRollback);
    res.once('close', scheduleRollback);

    // Also wrap res.end/res.json as last resort fallback
    const originalEnd = res.end.bind(res);
    const originalJson = res.json.bind(res);
    
    res.end = function(chunk?: any, encoding?: any) {
      scheduleRollback();
      return originalEnd.call(this, chunk, encoding);
    };

    res.json = function(body?: any) {
      scheduleRollback();
      return originalJson.call(this, body);
    };

    next();
  } catch (err) {
    // Error starting transaction - ensure client is released
    console.error('[TEST_TX] Failed to start transaction:', err);
    
    if (txClient) {
      try {
        txClient.release();
      } catch (releaseErr) {
        console.error('[TEST_TX] Error releasing client:', releaseErr);
      }
      req.ctx!.dbTxClient = undefined;
      req.testTx = false;
      txClient = null;
    }
    
    // Continue without transaction (fallback to normal behavior)
    next();
  }
}

/**
 * Helper to get the transaction client from request
 * Returns the transaction client if test mode is active, null otherwise
 */
export function getTestTxClient(req: Request): Client | null {
  return req.ctx?.dbTxClient || null;
}

/**
 * Helper to check if test transaction is active
 */
export function isTestTxActive(req: Request): boolean {
  return req.testTx === true && !!req.ctx?.dbTxClient;
}

