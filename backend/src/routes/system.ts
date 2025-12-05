/**
 * System Routes
 * Health, Telemetry, Budget monitoring, and Role Management endpoints
 * Extracted from legacy admin.ts monolith
 */

import { Router } from 'express';
import budgetRouter from './admin-budget.js';
import telemetryRouter from './admin-telemetry.js';
import healthRouter from './admin-health.js';
import rolesRouter from './system-roles.js';

const router = Router();

// Mount system monitoring routes
router.use('/budget', budgetRouter);
router.use('/telemetry', telemetryRouter);
router.use(healthRouter); // Mounts at /templates/health
router.use('/roles', rolesRouter); // Mounts at /api/system/roles

export default router;

