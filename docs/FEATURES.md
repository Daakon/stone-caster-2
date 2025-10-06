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
- **Character Persistence**: Characters are saved and can be reused across games
- **Character Attributes**: Characters have stats, skills, and backstories

### Adventure System
- **Adventure Library**: Curated collection of text-based adventures
- **Dynamic Narratives**: AI-generated story content based on player choices
- **Multiple Endings**: Adventures can have different outcomes based on player decisions

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
