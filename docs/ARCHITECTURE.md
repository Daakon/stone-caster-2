# Stonecaster Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Users                            │
│                   (Web Browsers)                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ HTTPS
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Cloudflare Workers                         │
│              (Frontend Hosting)                         │
│                                                          │
│  ┌────────────────────────────────────────────────┐   │
│  │          React + Vite Frontend                 │   │
│  │  • React Router for navigation                 │   │
│  │  • TanStack Query for data fetching            │   │
│  │  • Zustand for state management                │   │
│  │  • Mobile-first responsive design              │   │
│  │  • WCAG 2.1 accessibility                      │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ REST API
                       │
┌──────────────────────▼───────────────────────────────────┐
│                   Fly.io                                 │
│            (Backend API Hosting)                         │
│                                                          │
│  ┌────────────────────────────────────────────────┐   │
│  │         Node.js + Express API                  │   │
│  │                                                │   │
│  │  Routes:                                       │   │
│  │  • /api/characters - Character CRUD            │   │
│  │  • /api/games - Game save management           │   │
│  │  • /api/worlds - World templates               │   │
│  │  • /api/story - AI story processing            │   │
│  │  • /api/dice - Dice rolling mechanics          │   │
│  │                                                │   │
│  │  Services:                                     │   │
│  │  • AI Service (OpenAI integration)             │   │
│  │  • Dice Service (game mechanics)               │   │
│  │  • Supabase Client (database access)           │   │
│  └────────────────────────────────────────────────┘   │
└──────────────┬───────────────────────┬──────────────────┘
               │                       │
               │                       │
               │ PostgreSQL            │ REST API
               │                       │
┌──────────────▼──────────┐   ┌───────▼──────────────────┐
│      Supabase           │   │      OpenAI API          │
│                         │   │                          │
│  • PostgreSQL Database  │   │  • GPT-4 Turbo          │
│  • Authentication       │   │  • Story generation     │
│  • Row Level Security   │   │  • NPC interactions     │
│  • Real-time            │   │  • Skill check narration│
│                         │   │                          │
│  Tables:                │   └──────────────────────────┘
│  • characters           │
│  • game_saves           │
│  • world_templates      │
└─────────────────────────┘
```

## Data Flow

### Character Creation Flow
```
User Input → Frontend Validation → API Request → 
Backend Validation (Zod) → Database Insert → 
Response → UI Update
```

### Game Play Flow
```
User Action → Frontend → POST /api/story → 
Backend processes:
  1. Fetch game save & character
  2. Process skill checks (if needed)
  3. Call AI Service with context
  4. Update game state
  5. Save to database
→ AI Response → Frontend → UI Update
```

### AI Story Generation Flow
```
Story Action → Build Context (character, history, world) → 
OpenAI Chat Completion → Parse JSON Response → 
Update Story State → Return to Client
```

## Security Architecture

### Authentication Flow
```
User → Supabase Auth → JWT Token → 
Frontend stores token → 
API validates token (x-user-id header) → 
Database RLS enforces user isolation
```

### Row Level Security (RLS)
- Users can only access their own characters
- Users can only access their own game saves
- World templates: public visible to all, private only to creator
- All policies enforce user_id = auth.uid()

## Technology Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router 6
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Styling**: CSS with custom properties
- **Testing**: Vitest + Playwright
- **Hosting**: Cloudflare Workers

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express
- **Language**: TypeScript
- **Database Client**: Supabase JS
- **AI**: OpenAI SDK
- **Validation**: Zod
- **Testing**: Vitest
- **Hosting**: Fly.io

### Database
- **Provider**: Supabase
- **Database**: PostgreSQL
- **Features**: RLS, triggers, JSONB columns
- **Auth**: Supabase Auth (JWT)

### Shared
- **Types**: Zod schemas with TypeScript inference
- **Validation**: Shared validation logic
- **Build**: TypeScript compiler

## Deployment Architecture

### CI/CD Pipeline
```
GitHub Push → GitHub Actions →
  1. Lint & Type Check
  2. Run Unit Tests
  3. Run E2E Tests
  4. Build All Packages
  5. Deploy Frontend (Cloudflare)
  6. Deploy Backend (Fly.io)
```

### Production Environment
- **Frontend**: Distributed via Cloudflare CDN (global edge network)
- **Backend**: Fly.io with auto-scaling (geographic regions)
- **Database**: Supabase (managed PostgreSQL with replicas)
- **Secrets**: Environment variables via platform configs

## Performance Considerations

1. **Frontend**
   - Code splitting with React Router
   - Lazy loading of routes
   - React Query caching
   - Optimized bundle size

2. **Backend**
   - Database indexes on frequently queried columns
   - Connection pooling via Supabase
   - Efficient JSON queries with JSONB
   - Rate limiting on AI endpoints

3. **Database**
   - Indexed foreign keys
   - JSONB for flexible story state
   - Triggers for automatic timestamp updates
   - Partitioning for large tables (future)

## Scalability

### Horizontal Scaling
- Frontend: CDN edge servers (infinite scale)
- Backend: Fly.io auto-scaling based on load
- Database: Supabase read replicas

### Vertical Scaling
- Backend: Increase Fly.io machine specs
- Database: Supabase tier upgrades

## Monitoring & Observability

- **Frontend**: Browser performance API, error boundaries
- **Backend**: Health check endpoint, request logging
- **Database**: Supabase dashboard metrics
- **AI**: OpenAI usage tracking

## Future Enhancements

1. WebSocket support for multiplayer
2. Redis caching layer
3. GraphQL API option
4. Mobile native apps
5. Voice narration (text-to-speech)
6. Image generation for scenes
7. Advanced analytics dashboard
8. Community world template sharing
