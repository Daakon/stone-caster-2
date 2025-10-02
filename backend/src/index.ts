import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import charactersRouter from './routes/characters.js';
import gamesRouter from './routes/games.js';
import worldsRouter from './routes/worlds.js';
import storyRouter from './routes/story.js';
import diceRouter from './routes/dice.js';
import configRouter from './routes/config.js';
import meRouter from './routes/me.js';
import adventuresRouter from './routes/adventures.js';
import searchRouter from './routes/search.js';
import stonesRouter from './routes/stones.js';
import subscriptionRouter from './routes/subscription.js';
import telemetryRouter from './routes/telemetry.js';
import webhooksRouter from './routes/webhooks.js';
import { observabilityMiddleware } from './middleware/observability.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json());
app.use(observabilityMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/config', configRouter);
app.use('/api/me', meRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/worlds', worldsRouter);
app.use('/api/adventures', adventuresRouter);
app.use('/api/search', searchRouter);
app.use('/api/stones', stonesRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/story', storyRouter);
app.use('/api/dice', diceRouter);
app.use('/api/webhooks', webhooksRouter);

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
