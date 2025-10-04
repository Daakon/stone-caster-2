import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { swaggerSpec } from './config/swagger.js';
import charactersRouter from './routes/characters.js';
import gamesRouter from './routes/games.js';
import worldsRouter from './routes/worlds.js';
import storyRouter from './routes/story.js';
import diceRouter from './routes/dice.js';
import configRouter from './routes/config.js';
import meRouter from './routes/me.js';
import profileRouter from './routes/profile.js';
import adventuresRouter from './routes/adventures.js';
import searchRouter from './routes/search.js';
import stonesRouter from './routes/stones.js';
import subscriptionRouter from './routes/subscription.js';
import telemetryRouter from './routes/telemetry.js';
import webhooksRouter from './routes/webhooks.js';
import contentRouter from './routes/content.js';
import authRouter from './routes/auth.js';
import premadeCharactersRouter from './routes/premade-characters.js';
import cookieLinkingRouter from './routes/cookie-linking.js';
import { observabilityMiddleware } from './middleware/observability.js';

const app = express();

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
      'https://stonecaster.ai', // Production frontend
      'https://www.stonecaster.ai', // Production frontend with www
    ];
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, also allow the configured origin
    if (config.cors.origin && origin === config.cors.origin) {
      return callback(null, true);
    }
    
    // Log the blocked origin for debugging
    console.log(`[CORS] Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(observabilityMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/config', configRouter);
app.use('/api/me', meRouter);
app.use('/api/profile', profileRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/premades', premadeCharactersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/worlds', worldsRouter);
app.use('/api/content', contentRouter);
app.use('/api/adventures', adventuresRouter);
app.use('/api/search', searchRouter);
app.use('/api/stones', stonesRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/story', storyRouter);
app.use('/api/dice', diceRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/cookie-linking', cookieLinkingRouter);
app.use('/api/auth', authRouter);

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'StoneCaster API Documentation',
}));

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
  app.listen(port, () => {
    console.log(`🎲 Stonecaster API server running on port ${port}`);
    console.log(`📍 Health check: http://localhost:${port}/health`);
  });
}

export default app;
