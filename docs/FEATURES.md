# Stone Caster Features

## Overview

Stone Caster is a text-based adventure game platform that allows users to create characters, embark on adventures, and interact with AI-generated narratives. The platform supports both guest users (with cookie-based sessions) and authenticated users (with full account features).

## Core Features

### Guest User Support
- **Cookie-based Sessions**: Guest users can play without creating an account using browser cookies
- **Guest Wallet System**: Guest users receive starter casting stones and can spend them on game actions
- **Session Persistence**: Guest sessions persist across browser refreshes and page navigation
- **Seamless Play Flow**: Guest users can spawn games, submit turns, and play through adventures without authentication barriers

### Game Management
- **My Adventures Dashboard**: Resume active games via `/my-adventures` with quick links to `/play/:gameId`
- **Game Spawning**: Create new games from available adventures
- **Turn-based Gameplay**: Submit actions and receive AI-generated narrative responses
- **Game State Persistence**: Game progress is saved and can be resumed
- **Multi-world Support**: Games can be set in different fantasy worlds (Mystika, etc.)

### Stone Economy
- **Casting Stones**: Primary currency for game actions
- **Guest Starter Stones**: New guest users receive initial casting stones
- **Stone Spending**: Stones are consumed when submitting game turns
- **Ledger Tracking**: All stone transactions are recorded for audit purposes

### Character System
- **Character Creation**: Create custom characters or use premade templates
- **PlayerV3 System**: New character creation system with 0-100 skill scales and world-scoped traits
- **Character Persistence**: Characters are saved and can be reused across games
- **Character Attributes**: Characters have stats, skills, and backstories
- **Skill Point Allocation**: Point-buy system with 50 as baseline average
- **World-Scoped Traits**: Curated trait lists specific to each world
- **Equipment Kits**: Starting equipment based on character skills

### Adventure System
- **Adventure Library**: Curated collection of text-based adventures
- **Dynamic Narratives**: AI-generated story content based on player choices
- **Multiple Endings**: Adventures can have different outcomes based on player decisions

### AI System
- **Database-Backed Prompt System**: Efficient prompt assembly using Supabase database storage with RPC-based segment retrieval
- **Layered Prompt Architecture**: Structured prompt loading with the core -> world -> adventure -> adventure_start taxonomy plus an optional layer for experimental content
- **Prompt Caching**: In-memory caching of prompt segments for improved performance
- **OpenAI gpt-4o-mini Integration**: Modern AI model with streaming and retry capabilities
- **AWF Response Format**: Structured Action-Word-Format responses with scene, text, choices, and actions
- **Content Fixes**: Automated validation for RNG policy, player input, time format, and band naming
- **JSON Repair**: Automatic repair of malformed AI responses
- **Streaming Support**: Real-time token streaming for responsive gameplay
- **Initial Prompt System**: Automatic creation of initial AI prompts for games with no turns, including adventure start JSON to trigger immediate adventure loading
- **Enhanced Turn Recording**: Comprehensive turn data persistence with realtime and analytics storage
- **Prompt Versioning**: Hash-based change detection and version management for prompt segments
- **Role-Based Access**: Service role and prompt_admin can modify prompts, authenticated users get read-only access
- **Offline Narrative Loading**: Initialize narrative and turn history cached for offline play without re-hitting AI
- **Session Turn Management**: Efficient storage and retrieval of turn sequences with user prompts and narrative summaries
- **Admin Prompt Analytics**: Prompt admin tooling displays estimated token counts per prompt to guard against over-sized context.
- **Large Prompt Support**: API JSON limit raised (configurable via `API_JSON_BODY_LIMIT`) to support saving prompt bodies approaching 1 MB.

## Technical Features

### Authentication & Authorization
- **Dual Authentication**: Supports both guest (cookie) and authenticated (JWT) users
- **Session Management**: Secure session handling with proper cookie configuration
- **Route Protection**: Different access levels for guest vs authenticated users

### API Design
- **RESTful Endpoints**: Clean API design following REST principles
- **Zod Validation**: All API inputs are validated using Zod schemas
- **Consistent Error Handling**: Standardized error responses with proper HTTP status codes
- **Idempotency Support**: Critical operations support idempotency keys

### Data Management
- **Supabase Integration**: PostgreSQL database with real-time capabilities
- **Row Level Security (RLS)**: Database-level security policies
- **Data Validation**: Server-side validation of all data operations
- **Audit Logging**: Comprehensive logging of user actions and system events

### Frontend Features
- **React + Vite**: Modern frontend framework with fast development experience
- **shadcn/ui Components**: Consistent, accessible UI components
- **Mobile-first Design**: Responsive design optimized for mobile devices
- **Accessibility**: WCAG compliance with axe-core testing

### Testing & Quality
- **Comprehensive Testing**: Unit tests, integration tests, and e2e tests
- **Accessibility Testing**: Automated accessibility validation
- **Regression Testing**: Tests to prevent breaking changes
- **CI/CD Integration**: Automated testing and deployment pipelines

## Layer P0 Features (Guest Play Flow)

### Guest Authentication
- **Cookie-based Identity**: Guest users are identified by browser cookies
- **Automatic Guest Creation**: New guests are automatically assigned unique IDs
- **Session Persistence**: Guest sessions survive browser refreshes

### Guest Game Flow
- **Game Spawning**: Guests can spawn new games from available adventures
- **Turn Submission**: Guests can submit turns and receive AI responses
- **Stone Management**: Guests receive starter stones and can spend them on actions
- **Error Handling**: Proper error messages for insufficient stones or other issues

### Guest Wallet System
- **Starter Stones**: New guests receive initial casting stones
- **Transaction Recording**: All guest stone transactions are logged
- **Balance Tracking**: Guest wallet balances are maintained across sessions
- **Insufficient Stones Handling**: Clear error messages when guests run out of stones

## Layer P1 Features (Live Data Integration)

### Real-time Data Loading
- **Live API Integration**: Game page loads all data from server APIs instead of mock data
- **React Query Caching**: Efficient data fetching with automatic caching and background updates
- **Loading States**: Proper loading skeletons and error states for all data fetching
- **Optimistic Updates**: Turn submission with optimistic UI updates and rollback on failure

### Data Structure Consistency
- **Unified DTOs**: Consistent data transfer objects between frontend and backend
- **Field Mapping**: Proper mapping of API response fields to frontend expectations
- **Backward Compatibility**: Support for both legacy and new data structures
- **Type Safety**: Full TypeScript type safety across the data layer

### API Endpoints
- **Adventure API**: `/api/adventures` and `/api/adventures/:id` for adventure data
- **Character API**: `/api/characters/:id` for character information
- **World API**: `/api/worlds/:id` for world data and rules
- **Wallet API**: `/api/stones/wallet` for stone balance and inventory

### Error Handling
- **Graceful Degradation**: Proper error states when data fails to load
- **User-friendly Messages**: Clear error messages for different failure scenarios
- **Retry Logic**: Automatic retry for transient failures
- **Fallback Data**: Default values when optional data is missing

## Future Features (Planned)

### User Accounts
- **Account Creation**: Full user registration and login
- **Profile Management**: User profiles with preferences and settings
- **Data Migration**: Seamless upgrade from guest to authenticated user

### Enhanced Gameplay
- **Character Progression**: Character leveling and skill development
- **Multiplayer Support**: Collaborative adventures with other players
- **Custom Adventures**: User-created adventure content

### Monetization
- **Stone Packs**: Purchase additional casting stones
- **Premium Features**: Advanced features for paying users
- **Subscription Model**: Monthly subscriptions for unlimited play

## Security & Privacy

### Data Protection
- **No PII Logging**: Personal information is never logged
- **Secure Cookies**: HttpOnly, secure cookies for session management
- **CSRF Protection**: Cross-site request forgery protection
- **Input Sanitization**: All user inputs are sanitized and validated

### Access Control
- **Row Level Security**: Database-level access controls
- **JWT Validation**: Secure token-based authentication
- **Rate Limiting**: API rate limiting to prevent abuse
- **Audit Trails**: Comprehensive logging of all system access

## Performance & Scalability

### Optimization
- **Database Indexing**: Optimized database queries with proper indexes
- **Caching**: Strategic caching of frequently accessed data
- **Bundle Optimization**: Optimized frontend bundle sizes
- **Lazy Loading**: On-demand loading of non-critical resources

### Monitoring
- **Error Tracking**: Comprehensive error monitoring and alerting
- **Performance Metrics**: Real-time performance monitoring
- **User Analytics**: Privacy-respecting usage analytics
- **Health Checks**: Automated system health monitoring





