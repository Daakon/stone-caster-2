import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { swaggerSpec } from './config/swagger.js';
import type { RequestHandler } from 'express';
import meRouter from './routes/me.js';
import profileRouter from './routes/profile.js';
import catalogRouter from './routes/catalog.js';
import catalogNpcsRouter from './routes/catalogNpcs.js';
import authRouter from './routes/auth.js';
import debugRouter from './routes/debug.js';
import systemRouter from './routes/system.js';
import { observabilityMiddleware } from './middleware/observability.js';
import { testTxMiddleware } from './middleware/testTx.js';
import devDebugRouter from './routes/dev.debug.js';
import { devTestRouter } from './routes/dev.test.js';
import healthRouter from './routes/health.js';
import adminPreviewRouter from './routes/admin.preview.js';
import internalFlagsRouter from './routes/internalFlags.js';
import { openapiRouter } from './routes/openapi.js';
import { earlyAccessGuard } from './middleware/earlyAccessGuard.js';
import { initializeActionRegistry } from './actions/boot.js';
import chimeraRouter from './routes/chimera.js';

const app = express();

// Initialize action registry on startup
initializeActionRegistry().catch(err => {
  console.error('[Startup] Failed to initialize action registry:', err);
});

// Disable Express ETag middleware to use our custom ETag implementation
app.set('etag', false);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:5173',  // Local development (Vite default)
      'http://localhost:4173',  // Local development (Vite preview)
      'http://localhost:3000',  // Local development (alternative port)
      'https://stonecaster.ai', // Production frontend (HTTPS)
      'https://www.stonecaster.ai', // Production frontend with www (HTTPS)
      'http://stonecaster.ai', // Production frontend fallback (HTTP)
      'http://www.stonecaster.ai', // Production frontend fallback with www (HTTP)
    ];

    // Also allow any subdomain of stonecaster.ai (e.g., preview hosts)
    const stonecasterSubdomain = /^https:\/\/([a-z0-9-]+\.)*stonecaster\.ai$/i;

    // Add configured CORS origin if it exists and isn't already in the list
    if (config.cors.origin && !allowedOrigins.includes(config.cors.origin)) {
      allowedOrigins.push(config.cors.origin);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || stonecasterSubdomain.test(origin)) {
      return callback(null, true);
    }

    // Log the blocked origin for debugging
    console.log(`[CORS] Blocked origin: ${origin}`);
    console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  // Let cors echo back requested headers to avoid blocking custom ones (e.g., apikey, x-client-info)
  optionsSuccessStatus: 200,
}));
const JSON_BODY_LIMIT = process.env.API_JSON_BODY_LIMIT ?? '1mb';
app.use(express.json({
  limit: JSON_BODY_LIMIT,
}) as RequestHandler);
app.use(express.urlencoded({
  extended: true,
  limit: JSON_BODY_LIMIT,
}) as RequestHandler);
app.use(cookieParser());
app.use(observabilityMiddleware);
// Test transaction middleware (must come after observability for traceId)
app.use(testTxMiddleware);

// Health check - Phase 5.1: Expose test transaction availability
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    testTxEnabled: process.env.TEST_TX_ENABLED === 'true',
  });
});

// Phase B2: Early Access Guard - mount BEFORE protected routers
app.use(earlyAccessGuard);

// API Routes
app.use('/api/me', meRouter);
app.use('/api/profile', profileRouter);
// Catalog routes (includes both legacy and new unified entry-points)
app.use('/api/catalog', catalogRouter);
app.use('/api/catalog', catalogNpcsRouter);
app.use('/api/auth', authRouter);
app.use('/api/debug', debugRouter);
app.use('/api/system', systemRouter);
app.use('/api/health', healthRouter);
app.use('/api/internal', internalFlagsRouter);

// Access Requests (Phase B5)
import accessRequestsPublicRouter from './routes/accessRequests.public.js';
import accessRequestsAdminRouter from './routes/accessRequests.admin.js';
app.use('/api/request-access', accessRequestsPublicRouter);
app.use('/api/admin/access-requests', accessRequestsAdminRouter);

// Phase 5.3: Admin routes moved to V2 namespace (mounted in chimera.ts)

// Publishing Routes removed - not in approved functionality
// Phase 8: User authoring routes removed - replaced by Chimera routes

// V2 API: Project Chimera engine routes
app.use('/api/v2/chimera', chimeraRouter);

// Phase 2: Chimera API routes (using repositories)
// Note: These routes use the repository layer and are mounted at /api/chimera/*
// The existing routes at /api/v2/chimera/* are kept for backward compatibility
import chimeraWorldsRepoRouter from './routes/chimera-worlds-repo.js';
import chimeraRulesetsRepoRouter from './routes/chimera-rulesets-repo.js';
import chimeraEntitiesRepoRouter from './routes/chimera-entities-repo.js';
import chimeraLoreRepoRouter from './routes/chimera-lore-repo.js';
import chimeraAssetsRouter from './routes/chimera-assets.api.js';
import chimeraCompileRouter from './routes/chimera-compile.js';
import chimeraPlayRouter from './routes/chimera-play.js';
import chimeraGameInitRouter from './routes/chimera-game-init.js';
app.use('/api/chimera/worlds', chimeraWorldsRepoRouter);
console.log('[Server] Mounted /api/chimera/rulesets route');
app.use('/api/chimera/rulesets', chimeraRulesetsRepoRouter);
app.use('/api/chimera/entities', chimeraEntitiesRepoRouter);
app.use('/api/chimera/lore', chimeraLoreRepoRouter);
// app.use('/api/chimera/assets', chimeraAssetsRouter); // Moved to V2 router
app.use('/api/chimera/compile', chimeraCompileRouter);
app.use('/api/chimera/play', chimeraPlayRouter);
// Stories (V2 & V1 mixed context)
import chimeraStoriesRouter from './routes/chimera-stories.js';
app.use('/api/chimera/stories', chimeraStoriesRouter); // For legacy/mixed
app.use('/api/v2/chimera/stories', chimeraStoriesRouter); // For V2 strict

app.use('/api/chimera/game', chimeraGameInitRouter);

// Phase 3: Story Compiler Orchestrator
import compilerRouter from './routes/compiler.routes.js';
app.use(compilerRouter);

// OpenAPI documentation (Phase A5)
app.use('/api', openapiRouter);

// Admin preview routes (requires DEBUG_ROUTES_ENABLED + admin role)
if (config.debug.routesEnabled) {
  app.use('/api/admin/preview', adminPreviewRouter);
  console.log('🔧 Admin preview routes enabled at /api/admin/preview');
}

// Dev debug routes (feature-flagged, requires DEBUG_ROUTES_ENABLED=true and X-Debug-Token header)
if (config.debug.routesEnabled) {
  app.use('/api/dev/debug', devDebugRouter);
  app.use('/api/dev/test', devTestRouter);
  console.log('🔧 Debug routes enabled at /api/dev/debug and /api/dev/test');
  console.log('⚠️  WARNING: Debug routes should only be enabled in development/test environments');
} else {
  console.log('🔒 Debug routes disabled (set DEBUG_ROUTES_ENABLED=true to enable)');
}

// Swagger API documentation (only in development/staging)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
  // Serve Swagger JSON at a different path
  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'StoneCaster API Documentation',
    swaggerOptions: {
      url: '/swagger.json'
    }
  }));

  console.log(`📚 Swagger UI available at: http://localhost:${config.port}/api-docs`);
  console.log(`📄 Swagger JSON available at: http://localhost:${config.port}/swagger.json`);
}

// Error handling
// _next is intentionally unused (error handler signature). Disable unused var rule for this line.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const port = config.port;

  // Seed slots and templates on boot if empty
  (async () => {
    try {
      const { seedIfEmpty } = await import('./scripts/seed-slots-templates.js');
      await seedIfEmpty();
    } catch (error) {
      console.error('[Boot] Failed to seed slots/templates:', error);
      // Don't fail startup if seeding fails
    }
  })();

  app.listen(port, () => {
    console.log(`🎲 Stonecaster API server running on port ${port}`);
    console.log(`📍 Health check: http://localhost:${port}/health`);

    // Phase 4: Start dependency monitor cron job (if enabled)
    (async () => {
      try {
        const { startDependencyMonitor } = await import('./jobs/dependencyMonitor.job.js');
        startDependencyMonitor();
      } catch (error) {
        console.error('[Boot] Failed to start dependency monitor:', error);
        // Don't fail startup if monitor fails to start
      }
    })();
  });
}

export default app;
