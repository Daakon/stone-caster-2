import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import charactersRouter from './routes/characters.js';
import gamesRouter from './routes/games.js';
import worldsRouter from './routes/worlds.js';
import storyRouter from './routes/story.js';
import diceRouter from './routes/dice.js';
import configRouter from './routes/config.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/config', configRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/worlds', worldsRouter);
app.use('/api/story', storyRouter);
app.use('/api/dice', diceRouter);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = config.port;
app.listen(port, () => {
  console.log(`🎲 Stonecaster API server running on port ${port}`);
  console.log(`📍 Health check: http://localhost:${port}/health`);
});

export default app;
