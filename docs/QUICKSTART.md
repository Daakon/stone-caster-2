# Quick Start Guide

Get Stonecaster running in under 5 minutes!

## Prerequisites

✅ Node.js 20+
✅ npm 10+

## 1. Clone & Install (1 minute)

```bash
git clone https://github.com/Daakon/stone-caster-2.git
cd stone-caster-2
npm install
```

## 2. Configure Environment (2 minutes)

### Backend Setup

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
# Get from https://supabase.com
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Get from https://platform.openai.com
OPENAI_API_KEY=sk-...
```

### Frontend Setup

```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3000
```

## 3. Setup Database (1 minute)

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create new project
3. Go to SQL Editor
4. Copy/paste `supabase/migrations/001_initial_schema.sql`
5. Run it

## 4. Build Shared Package (30 seconds)

```bash
cd ../shared
npm run build
```

## 5. Start Development (30 seconds)

Open two terminals:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 6. Open in Browser

Go to: `http://localhost:5173`

## 🎉 You're Done!

- Click "Get Started" to create an account
- Create your first character
- Choose a world template
- Start your adventure!

## Common Issues

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
npm run build --workspace=shared
```

### "Port already in use"
Change `PORT` in `backend/.env` to 3001

### Can't connect to Supabase
Double-check your URLs and keys in `.env` files

## Need Help?

📖 Full setup guide: [docs/SETUP.md](./SETUP.md)
🏗️ Architecture: [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
📡 API docs: [docs/API.md](./API.md)

Happy Gaming! 🎲🎮
