# 🎲 Stonecaster

An AI-driven role-playing game platform featuring dynamic character creation, persistent game saves, world templates, and AI-powered storytelling with emotional continuity and NPC agency.

## 🌟 Features

- **🤖 AI-Powered Storytelling**: Dynamic narratives powered by OpenAI with emotional continuity
- **⚔️ Dynamic Character Creation**: Rich character customization with attributes, skills, and backstories
- **💾 Persistent Game Saves**: Your adventures are automatically saved and can be resumed anytime
- **🌍 World Templates**: Choose from fantasy, sci-fi, horror, and custom world settings
- **🎭 NPC Agency**: Non-player characters with personalities, goals, and evolving relationships
- **🎲 Structured Game Mechanics**: D20-based dice rolling system with skill checks
- **📱 Mobile-First Design**: Responsive interface optimized for all devices
- **♿ Accessibility**: WCAG 2.1 compliant with ARIA labels and keyboard navigation
- **🧪 Comprehensive Testing**: Unit tests with Vitest and E2E tests with Playwright

## 🏗️ Architecture

### Monorepo Structure

```
stone-caster-2/
├── frontend/          # React + Vite frontend
├── backend/           # Node + Express API
├── shared/            # Shared types and utilities
├── supabase/          # Database migrations
└── docs/              # Documentation
```

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for fast builds
- React Router for navigation
- TanStack Query for data fetching
- Zustand for state management
- Vitest + Playwright for testing

**Backend:**
- Node.js + Express
- TypeScript
- Supabase for database and auth
- OpenAI for AI storytelling
- Zod for validation

**Infrastructure:**
- Supabase for PostgreSQL database
- Cloudflare Workers for frontend deployment
- Fly.io for backend deployment

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Daakon/stone-caster-2.git
cd stone-caster-2
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

**Backend** (`backend/.env`):
```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview
CORS_ORIGIN=http://localhost:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000
```

4. Set up Supabase:
```bash
# Run the migration
# In Supabase SQL Editor, execute: supabase/migrations/001_initial_schema.sql
```

5. Start development servers:
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev --workspace=frontend
npm run dev --workspace=backend
```

The frontend will be available at `http://localhost:5173` and the backend at `http://localhost:3000`.

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run frontend tests
npm test --workspace=frontend

# Run backend tests
npm test --workspace=backend

# Run with coverage
npm test -- --coverage
```

### E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e --workspace=frontend

# Run in UI mode
npx playwright test --ui
```

## 🔨 Building

```bash
# Build all packages
npm run build

# Build frontend only
npm run build --workspace=frontend

# Build backend only
npm run build --workspace=backend
```

## 📦 Deployment

### Frontend (Cloudflare Workers)

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Deploy:
```bash
cd frontend
npm run build
wrangler deploy
```

### Backend (Fly.io)

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly:
```bash
fly auth login
```

3. Deploy:
```bash
cd backend
fly launch  # First time only
fly deploy
```

## 🎮 Usage

### Creating a Character

1. Sign up or sign in
2. Navigate to "My Characters"
3. Click "Create New Character"
4. Choose race, class, and attributes
5. AI will generate a backstory suggestion

### Starting an Adventure

1. Select a character from your list
2. Choose a world template (Fantasy, Sci-Fi, Horror, etc.)
3. Start your adventure!

### Playing the Game

- Type actions in the input field
- The AI Game Master responds with narrative
- Use suggested actions for quick responses
- Your progress is automatically saved

## 🎨 Game Mechanics

### Attributes
- Strength, Dexterity, Constitution
- Intelligence, Wisdom, Charisma
- Each ranges from 1-20

### Dice Rolling
- D20-based system
- Advantage/Disadvantage support
- Automatic skill checks

### Story System
- Dynamic narrative generation
- Emotional continuity tracking
- NPC relationship management
- World state persistence

## ♿ Accessibility Features

- ARIA labels and roles throughout
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Reduced motion support
- Focus indicators
- Mobile-first responsive design

## 📚 API Documentation

### Characters
- `GET /api/characters` - List characters
- `GET /api/characters/:id` - Get character
- `POST /api/characters` - Create character
- `PUT /api/characters/:id` - Update character
- `DELETE /api/characters/:id` - Delete character

### Game Saves
- `GET /api/games` - List game saves
- `GET /api/games/:id` - Get game save
- `POST /api/games` - Create game save
- `PUT /api/games/:id` - Update game save
- `DELETE /api/games/:id` - Delete game save

### World Templates
- `GET /api/worlds` - List world templates
- `GET /api/worlds/:id` - Get world template
- `POST /api/worlds` - Create world template

### Story Actions
- `POST /api/story` - Process story action

### Dice
- `POST /api/dice` - Roll dice
- `POST /api/dice/multiple` - Roll multiple dice

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

ISC

## 🔗 Links

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

## 🙏 Acknowledgments

- OpenAI for powering the AI storytelling
- Supabase for the backend infrastructure
- The open-source community

---

Built with ❤️ for tabletop RPG enthusiasts
