# Stonecaster Setup Guide

This guide will help you set up the Stonecaster development environment from scratch.

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 20+** - [Download here](https://nodejs.org/)
2. **npm 10+** (comes with Node.js)
3. **Git** - [Download here](https://git-scm.com/)
4. **Supabase Account** - [Sign up here](https://supabase.com/)
5. **OpenAI API Key** - [Get one here](https://platform.openai.com/)

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/Daakon/stone-caster-2.git
cd stone-caster-2

# Install all dependencies (uses npm workspaces)
npm install
```

## Step 2: Set Up Supabase

### 2.1 Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Choose an organization and name your project
4. Choose a secure database password
5. Select a region close to you
6. Wait for the project to be created (~2 minutes)

### 2.2 Get Your Supabase Credentials

1. In your Supabase project dashboard, click "Settings" → "API"
2. Copy these values (you'll need them later):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long JWT token)
   - **service_role key**: `eyJhbGc...` (another long JWT token)

⚠️ **Important**: Keep the service_role key secret! Never expose it in client-side code.

### 2.3 Run Database Migrations

1. In your Supabase dashboard, go to "SQL Editor"
2. Click "New Query"
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the query editor
5. Click "Run" to execute the migration
6. You should see: "Success. No rows returned"

This will create:
- `characters` table
- `game_saves` table
- `world_templates` table
- All necessary indexes and Row Level Security policies
- Default world templates (Fantasy, Cyberpunk, Horror)

### 2.4 Verify the Setup

1. Go to "Table Editor" in your Supabase dashboard
2. You should see three tables: `characters`, `game_saves`, `world_templates`
3. Click on `world_templates` - you should see 3 rows with default worlds

## Step 3: Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to "API Keys" section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)
6. Add credits to your OpenAI account if needed

⚠️ **Cost Warning**: OpenAI API usage is not free. GPT-4 Turbo costs ~$0.01 per 1K input tokens. Budget accordingly!

## Step 4: Configure Environment Variables

### 4.1 Backend Configuration

Create `backend/.env`:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your values:

```env
# Server
PORT=3000
NODE_ENV=development

# Supabase (from Step 2.2)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (from Step 3)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 4.2 Frontend Configuration

Create `frontend/.env`:

```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
# Supabase (same as backend, but only anon key)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API
VITE_API_URL=http://localhost:3000
```

## Step 5: Build Shared Package

The shared package contains TypeScript types used by both frontend and backend.

```bash
cd ../shared
npm run build
```

You should see TypeScript compilation complete without errors.

## Step 6: Start Development Servers

Open two terminal windows:

### Terminal 1 - Backend

```bash
cd backend
npm run dev
```

You should see:
```
🎲 Stonecaster API server running on port 3000
📍 Health check: http://localhost:3000/health
```

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

You should see:
```
VITE v7.1.7  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## Step 7: Verify the Installation

1. Open your browser to `http://localhost:5173`
2. You should see the Stonecaster homepage
3. Click "Get Started" to create an account
4. Enter an email and password (Supabase will handle auth)
5. You should be redirected to the characters page

### Test the Backend API

```bash
# In a new terminal
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

## Step 8: Run Tests

### Unit Tests

```bash
# From project root
npm test
```

This runs tests in all workspaces.

### E2E Tests

```bash
# Install Playwright browsers (first time only)
cd frontend
npx playwright install

# Run E2E tests
npm run test:e2e
```

## Troubleshooting

### "Module not found" errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build --workspace=shared
```

### "Port already in use"

Change the PORT in `backend/.env` to another port (e.g., 3001).
Also update `VITE_API_URL` in `frontend/.env` to match.

### Supabase connection errors

1. Verify your SUPABASE_URL and keys are correct
2. Check if your Supabase project is active
3. Verify network connectivity

### OpenAI API errors

1. Verify your OPENAI_API_KEY is correct
2. Check if you have credits in your OpenAI account
3. Try using a different model (e.g., `gpt-3.5-turbo`)

### Database migration errors

1. Make sure you copied the entire SQL file
2. Run the migration in a fresh database
3. Check for syntax errors in the SQL editor

### Frontend build errors with React 19

If you encounter peer dependency issues:
```bash
cd frontend
npm install --legacy-peer-deps
```

## Next Steps

Now that everything is set up:

1. **Create your first character**: Navigate to "Create New Character"
2. **Start an adventure**: Select a world template and begin playing
3. **Explore the code**: Check out the architecture documentation
4. **Make changes**: The dev servers hot-reload on file changes
5. **Write tests**: Add tests for new features
6. **Read the API docs**: See README.md for API endpoints

## Development Tips

1. **Use the health check**: `http://localhost:3000/health` to verify backend
2. **Check browser console**: For frontend errors and network requests
3. **Use React DevTools**: Install for better React debugging
4. **Monitor OpenAI usage**: Check your OpenAI dashboard for API costs
5. **Use Supabase logs**: View real-time logs in Supabase dashboard

## Optional Tools

- **Docker**: For containerized development (Dockerfile included)
- **VSCode**: Recommended IDE with TypeScript support
- **Postman**: For testing API endpoints
- **React DevTools**: Browser extension for React debugging

## Need Help?

- Check the [Architecture docs](./ARCHITECTURE.md)
- Read the main [README](../README.md)
- Open an issue on GitHub
- Check existing issues for solutions

Happy developing! 🎲🎮
