/**
 * System Routes
 * Health, Telemetry, and Budget monitoring endpoints
 * Extracted from legacy admin.ts monolith
 */

import { Router } from 'express';
import budgetRouter from './admin-budget.js';
import telemetryRouter from './admin-telemetry.js';
import healthRouter from './admin-health.js';

const router = Router();

// Mount system monitoring routes
router.use('/budget', budgetRouter);
router.use('/telemetry', telemetryRouter);
router.use(healthRouter); // Mounts at /templates/health

export default router;

