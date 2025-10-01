# Stone Caster: Layer-by-Layer Implementation Plan

## Overview

This document tracks our systematic approach to hardening and building the Stone Caster application. Each layer must be completely solid before moving to the next, following TDD principles and the established cursor rules.

## Project Standards

- **Mobile-First**: All features tested at 375×812 before desktop
- **TDD**: Unit tests, E2E tests, and accessibility tests for every change
- **Quality Gates**: Linting, type-checking, and builds must pass
- **Documentation**: Update docs in same PR as code changes
- **Branch Strategy**: One branch per layer, complete before moving to next

## Current State Assessment

### ✅ What's Working
- Basic monorepo structure (frontend/backend/shared)
- Configuration spine with hot-reload and ETag caching
- Basic database schema with RLS policies
- Backend API with basic CRUD operations
- Frontend React app with routing
- Testing infrastructure (Vitest + Playwright)

### ❌ Critical Issues to Fix
- E2E tests failing (frontend not loading properly)
- Missing Tailwind CSS and shadcn/ui dependencies
- No mobile navigation system
- Incomplete API validation
- Missing core database tables
- No stone economy system
- No guest user system

## Layer Implementation Plan

---

## **LAYER 0: Foundation Hardening**
*Goal: Make existing code rock-solid before adding features*

### 0.1 Fix Build & Test Infrastructure
**Branch**: `layer-0.1/fix-build-test-infrastructure`

**Problem**: E2E tests failing, missing critical dependencies

**Tasks**:
1. Add missing dependencies to frontend and backend
2. Fix E2E test failures
3. Ensure frontend loads correctly
4. Fix mobile viewport issues (375×812)
5. Configure proper linting rules

**Acceptance Criteria**:
- ✅ All E2E tests pass
- ✅ Frontend loads correctly on mobile (375×812)
- ✅ No linting errors
- ✅ TypeScript compiles without errors
- ✅ All existing functionality works

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-0.1/fix-build-test-infrastructure

# 2. Install dependencies
npm install

# 3. Set up environment variables
# Backend (.env):
PORT=3000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
OPENAI_API_KEY=your_openai_api_key
PRIMARY_AI_MODEL=gpt-4-turbo-preview
SESSION_SECRET=your_session_secret
CORS_ORIGIN=http://localhost:5173

# Frontend (.env):
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000

# 4. Run database migrations
# Execute in Supabase SQL Editor:
# - supabase/migrations/001_initial_schema.sql
# - supabase/migrations/002_config_tables.sql
# - supabase/migrations/003_config_seed.sql

# 5. Start development servers
npm run dev

# 6. Test the application
# - Frontend: http://localhost:5173
# - Backend: http://localhost:3000/health
# - Test mobile viewport: 375×812
# - Verify all pages load correctly
# - Check navigation works

# 7. Run tests
npm test
npm run test:e2e --workspace=frontend

# 8. Run linting
npm run lint --workspaces

# 9. Run type checking
npm run type-check --workspaces
```

**Expected Outcome**: 
- Application loads and runs locally without errors
- All tests pass
- Mobile viewport works correctly
- No linting or type errors

---

### 0.2 Implement Tailwind CSS + shadcn/ui
**Branch**: `layer-0.2/tailwind-shadcn-setup`

**Problem**: Using custom CSS instead of specified Tailwind

**Tasks**:
1. Configure Tailwind CSS
2. Set up shadcn/ui components
3. Migrate existing CSS to Tailwind utility classes
4. Create base component library
5. Implement dark mode support

**Acceptance Criteria**:
- ✅ All pages use Tailwind utility classes
- ✅ shadcn/ui components available
- ✅ Mobile-first responsive design works
- ✅ Dark mode support
- ✅ No custom CSS files

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-0.2/tailwind-shadcn-setup

# 2. Install dependencies (if not already done)
npm install

# 3. Start development servers
npm run dev

# 4. Test the application
# - Frontend: http://localhost:5173
# - Verify all pages use Tailwind classes
# - Test responsive design at 375×812, 768×1024, 1920×1080
# - Test dark mode toggle
# - Verify shadcn/ui components work
# - Check that no custom CSS is being used

# 5. Run tests
npm test
npm run test:e2e --workspace=frontend

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- All pages styled with Tailwind utility classes
- shadcn/ui components functional
- Responsive design works across all viewports
- Dark mode toggle works
- No custom CSS files remain

---

### 0.3 Add Mobile Navigation System
**Branch**: `layer-0.3/mobile-navigation`

**Problem**: Missing required mobile drawer navigation

**Tasks**:
1. Create mobile hamburger menu component
2. Implement drawer navigation for authed routes
3. Add persistent sidebar for md+ screens
4. Ensure proper accessibility
5. Add keyboard navigation support

**Acceptance Criteria**:
- ✅ Mobile hamburger menu works
- ✅ Drawer navigation functional
- ✅ Desktop sidebar persistent
- ✅ Keyboard navigation works
- ✅ Screen reader accessible

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-0.3/mobile-navigation

# 2. Start development servers
npm run dev

# 3. Test mobile navigation
# - Frontend: http://localhost:5173
# - Test at 375×812 viewport
# - Verify hamburger menu appears
# - Test drawer opening/closing
# - Test navigation links work
# - Test keyboard navigation (Tab, Enter, Escape)
# - Test screen reader with VoiceOver/NVDA

# 4. Test desktop navigation
# - Test at 1024×768 and larger
# - Verify persistent sidebar
# - Test sidebar collapse/expand
# - Test navigation links work

# 5. Run tests
npm test
npm run test:e2e --workspace=frontend

# 6. Run accessibility tests
npx playwright test --grep="accessibility"

# 7. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Mobile hamburger menu and drawer work perfectly
- Desktop sidebar is persistent and functional
- Full keyboard navigation support
- Screen reader accessible
- All navigation tests pass

---

### 0.4 Complete Backend API Validation
**Branch**: `layer-0.4/api-validation`

**Problem**: Missing Zod validation on all endpoints

**Tasks**:
1. Add Zod schemas for all request/response types
2. Implement consistent error response format
3. Add proper JWT authentication middleware
4. Ensure all endpoints return `{ ok, data?, error? }` format
5. Add comprehensive API documentation

**Acceptance Criteria**:
- ✅ All API inputs validated with Zod
- ✅ Consistent error response format
- ✅ JWT authentication working
- ✅ No `any` types in API code
- ✅ All endpoints documented

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-0.4/api-validation

# 2. Start development servers
npm run dev

# 3. Test API endpoints
# - Backend: http://localhost:3000
# - Test health endpoint: GET /health
# - Test config endpoint: GET /api/config
# - Test characters endpoints with invalid data
# - Test games endpoints with invalid data
# - Test worlds endpoints with invalid data
# - Verify all errors return consistent format
# - Test JWT authentication on protected routes

# 4. Test with API client (Postman/curl)
curl -X GET http://localhost:3000/health
curl -X GET http://localhost:3000/api/config
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# 5. Run tests
npm test --workspace=backend
npm run test:e2e --workspace=frontend

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- All API endpoints validate input with Zod
- Consistent error response format
- JWT authentication works correctly
- No TypeScript `any` types
- All API tests pass

---

## **LAYER 1: Core Database Schema**
*Goal: Complete database foundation before building features*

### 1.1 Add Missing Core Tables
**Branch**: `layer-1.1/missing-database-tables`

**Problem**: Missing stone economy, guest users, adventures

**Tasks**:
1. Create migration for missing tables
2. Add proper indexes and constraints
3. Implement RLS policies for all tables
4. Add audit triggers for stone ledger
5. Update database documentation

**Acceptance Criteria**:
- ✅ All database tables from spec exist
- ✅ RLS policies enforce proper access
- ✅ Indexes optimize query performance
- ✅ Audit trail for stone transactions
- ✅ Migration runs cleanly

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-1.1/missing-database-tables

# 2. Run new migrations
# Execute in Supabase SQL Editor:
# - supabase/migrations/004_missing_tables.sql
# - supabase/migrations/005_stone_economy.sql
# - supabase/migrations/006_guest_users.sql
# - supabase/migrations/007_adventures.sql

# 3. Start development servers
npm run dev

# 4. Test database functionality
# - Backend: http://localhost:3000
# - Test config endpoint: GET /api/config
# - Verify all tables exist in Supabase dashboard
# - Test RLS policies work correctly
# - Verify indexes are created
# - Test audit triggers

# 5. Run database tests
npm test --workspace=backend

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- All required database tables exist
- RLS policies enforce proper access control
- Database indexes improve query performance
- Audit triggers work correctly
- All database tests pass

---

### 1.2 Implement Stone Economy Backend
**Branch**: `layer-1.2/stone-economy-backend`

**Problem**: No stone wallet or economy system

**Tasks**:
1. Create stone wallet service
2. Implement stone ledger for audit trail
3. Add stone conversion system
4. Create daily stone regeneration job
5. Add stone consumption on turns

**Acceptance Criteria**:
- ✅ Stone wallets functional
- ✅ Stone ledger tracks all transactions
- ✅ Conversion system works
- ✅ Daily regeneration implemented
- ✅ Turn consumption deducts stones

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-1.2/stone-economy-backend

# 2. Start development servers
npm run dev

# 3. Test stone economy
# - Backend: http://localhost:3000
# - Test stone wallet endpoints
# - Test stone conversion endpoints
# - Test stone ledger functionality
# - Verify stone consumption on turns
# - Test daily regeneration (if implemented)

# 4. Test with API client
curl -X GET http://localhost:3000/api/stones/wallet
curl -X POST http://localhost:3000/api/stones/convert \
  -H "Content-Type: application/json" \
  -d '{"from": "shard", "to": "casting", "amount": 10}'

# 5. Run tests
npm test --workspace=backend
npm run test:e2e --workspace=frontend

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Stone wallet system fully functional
- Stone ledger tracks all transactions
- Conversion system works correctly
- Stone consumption on turns works
- All stone economy tests pass

---

## **LAYER 2: Guest User System**
*Goal: Cookie-based guest authentication before auth features*

### 2.1 Guest Authentication Backend
**Branch**: `layer-2.1/guest-auth-backend`

**Problem**: No guest user system

**Tasks**:
1. Implement cookie-based guest sessions
2. Create guest stone wallets
3. Add guest-to-user migration system
4. Implement guest session management
5. Add guest user API endpoints

**Acceptance Criteria**:
- ✅ Guests can create accounts instantly
- ✅ Guest stone wallets work
- ✅ Migration to full accounts functional
- ✅ Session management secure

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-2.1/guest-auth-backend

# 2. Start development servers
npm run dev

# 3. Test guest authentication
# - Backend: http://localhost:3000
# - Test guest session creation
# - Test guest stone wallet
# - Test guest-to-user migration
# - Verify session security

# 4. Test with API client
curl -X POST http://localhost:3000/api/guest/session
curl -X GET http://localhost:3000/api/guest/wallet

# 5. Run tests
npm test --workspace=backend
npm run test:e2e --workspace=frontend

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Guest authentication system works
- Guest stone wallets functional
- Migration to full accounts works
- Session management is secure
- All guest auth tests pass

---

### 2.2 Guest User Frontend
**Branch**: `layer-2.2/guest-auth-frontend`

**Problem**: No guest user UI

**Tasks**:
1. Create guest onboarding flow
2. Add guest stone wallet display
3. Implement guest-to-user upgrade flow
4. Add guest session persistence
5. Create guest user components

**Acceptance Criteria**:
- ✅ Guest onboarding works
- ✅ Guest wallet visible
- ✅ Upgrade flow functional
- ✅ Sessions persist correctly

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-2.2/guest-auth-frontend

# 2. Start development servers
npm run dev

# 3. Test guest user frontend
# - Frontend: http://localhost:5173
# - Test guest onboarding flow
# - Test guest wallet display
# - Test upgrade to full account
# - Verify session persistence
# - Test at 375×812 viewport

# 4. Run tests
npm test
npm run test:e2e --workspace=frontend

# 5. Run accessibility tests
npx playwright test --grep="accessibility"

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Guest onboarding flow works perfectly
- Guest wallet display functional
- Upgrade to full account works
- Session persistence works correctly
- All guest frontend tests pass

---

## **LAYER 3: AI Turn Engine**
*Goal: Proper turn-based gameplay with stone consumption*

### 3.1 Turn System Backend
**Branch**: `layer-3.1/turn-system-backend`

**Problem**: No proper turn-based system

**Tasks**:
1. Implement idempotency key handling
2. Create prompt assembly from DB templates
3. Add JSON validation for AI responses
4. Implement stone deduction per turn
5. Add turn history and state management

**Acceptance Criteria**:
- ✅ Turn system idempotent
- ✅ Prompts assembled from DB
- ✅ AI responses validated
- ✅ Stones deducted per turn
- ✅ Turn history maintained

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-3.1/turn-system-backend

# 2. Start development servers
npm run dev

# 3. Test turn system
# - Backend: http://localhost:3000
# - Test turn creation with idempotency
# - Test prompt assembly from DB
# - Test AI response validation
# - Test stone deduction
# - Test turn history

# 4. Test with API client
curl -X POST http://localhost:3000/api/games/123/turn \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-123" \
  -d '{"action": "test action"}'

# 5. Run tests
npm test --workspace=backend
npm run test:e2e --workspace=frontend

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Turn system is idempotent
- Prompts assembled from database
- AI responses properly validated
- Stone deduction works correctly
- Turn history maintained
- All turn system tests pass

---

### 3.2 Turn System Frontend
**Branch**: `layer-3.2/turn-system-frontend`

**Problem**: No turn-based UI

**Tasks**:
1. Create turn input interface
2. Add stone cost display
3. Implement turn history view
4. Add loading states and error handling
5. Create turn-based game components

**Acceptance Criteria**:
- ✅ Turn input works
- ✅ Stone costs displayed
- ✅ History viewable
- ✅ Proper error handling

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-3.2/turn-system-frontend

# 2. Start development servers
npm run dev

# 3. Test turn system frontend
# - Frontend: http://localhost:5173
# - Test turn input interface
# - Test stone cost display
# - Test turn history view
# - Test error handling
# - Test at 375×812 viewport

# 4. Run tests
npm test
npm run test:e2e --workspace=frontend

# 5. Run accessibility tests
npx playwright test --grep="accessibility"

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Turn input interface works perfectly
- Stone costs displayed correctly
- Turn history viewable
- Error handling works properly
- All turn frontend tests pass

---

## **LAYER 4: Adventure System**
*Goal: Full adventure/quest mechanics*

### 4.1 Adventure Backend
**Branch**: `layer-4.1/adventure-backend`

**Problem**: No adventure system

**Tasks**:
1. Implement adventure browsing and filtering
2. Add quest progression system
3. Create world-specific rules
4. Add relationship/faction tracking
5. Create adventure API endpoints

**Acceptance Criteria**:
- ✅ Adventure browsing works
- ✅ Quest progression functional
- ✅ World rules enforced
- ✅ Relationships tracked

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-4.1/adventure-backend

# 2. Start development servers
npm run dev

# 3. Test adventure system
# - Backend: http://localhost:3000
# - Test adventure browsing
# - Test quest progression
# - Test world rules
# - Test relationship tracking

# 4. Test with API client
curl -X GET http://localhost:3000/api/adventures
curl -X GET http://localhost:3000/api/adventures/123/quests

# 5. Run tests
npm test --workspace=backend
npm run test:e2e --workspace=frontend

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Adventure browsing system works
- Quest progression functional
- World rules properly enforced
- Relationship tracking works
- All adventure backend tests pass

---

### 4.2 Adventure Frontend
**Branch**: `layer-4.2/adventure-frontend`

**Problem**: No adventure UI

**Tasks**:
1. Create adventure browser
2. Add quest progression UI
3. Implement world rules display
4. Add relationship/faction panels
5. Create adventure components

**Acceptance Criteria**:
- ✅ Adventure browser functional
- ✅ Quest UI works
- ✅ World rules displayed
- ✅ Relationship panels working

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-4.2/adventure-frontend

# 2. Start development servers
npm run dev

# 3. Test adventure frontend
# - Frontend: http://localhost:5173
# - Test adventure browser
# - Test quest progression UI
# - Test world rules display
# - Test relationship panels
# - Test at 375×812 viewport

# 4. Run tests
npm test
npm run test:e2e --workspace=frontend

# 5. Run accessibility tests
npx playwright test --grep="accessibility"

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Adventure browser works perfectly
- Quest progression UI functional
- World rules displayed correctly
- Relationship panels working
- All adventure frontend tests pass

---

## **LAYER 5: Feature Toggles & Dimensional Drifter**
*Goal: Dynamic UI based on configuration*

### 5.1 Feature Toggle Integration
**Branch**: `layer-5.1/feature-toggles`

**Problem**: Config exists but not integrated

**Tasks**:
1. Connect frontend to config service
2. Implement feature flag UI components
3. Add conditional rendering based on flags
4. Create Dimensional Drifter component
5. Add feature flag documentation

**Acceptance Criteria**:
- ✅ UI reacts to feature flags
- ✅ Dimensional Drifter works
- ✅ Config changes reflect in UI
- ✅ Feature flags documented

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-5.1/feature-toggles

# 2. Start development servers
npm run dev

# 3. Test feature toggles
# - Frontend: http://localhost:5173
# - Test feature flag UI components
# - Test Dimensional Drifter component
# - Test conditional rendering
# - Test config changes reflect in UI
# - Test at 375×812 viewport

# 4. Run tests
npm test
npm run test:e2e --workspace=frontend

# 5. Run accessibility tests
npx playwright test --grep="accessibility"

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Feature flag UI components work
- Dimensional Drifter component functional
- Conditional rendering based on flags works
- Config changes reflect in UI
- All feature toggle tests pass

---

## **LAYER 6: Payment Integration**
*Goal: Stone purchases and subscriptions*

### 6.1 Payment Backend
**Branch**: `layer-6.1/payment-backend`

**Problem**: No payment system

**Tasks**:
1. Integrate Stripe for stone purchases
2. Add subscription management
3. Implement webhook handling
4. Add payment audit trail
5. Create payment API endpoints

**Acceptance Criteria**:
- ✅ Stripe integration works
- ✅ Subscriptions functional
- ✅ Webhooks handled
- ✅ Payment audit trail

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-6.1/payment-backend

# 2. Set up Stripe test environment
# Add to backend/.env:
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 3. Start development servers
npm run dev

# 4. Test payment system
# - Backend: http://localhost:3000
# - Test Stripe integration
# - Test subscription management
# - Test webhook handling
# - Test payment audit trail

# 5. Test with API client
curl -X POST http://localhost:3000/api/stones/purchase \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "payment_method": "pm_test_..."}'

# 6. Run tests
npm test --workspace=backend
npm run test:e2e --workspace=frontend

# 7. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Stripe integration works correctly
- Subscription management functional
- Webhook handling works
- Payment audit trail maintained
- All payment backend tests pass

---

### 6.2 Payment Frontend
**Branch**: `layer-6.2/payment-frontend`

**Problem**: No payment UI

**Tasks**:
1. Create stone purchase UI
2. Add subscription management
3. Implement payment forms
4. Add purchase history
5. Create payment components

**Acceptance Criteria**:
- ✅ Purchase UI works
- ✅ Subscription management
- ✅ Payment forms secure
- ✅ History viewable

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-6.2/payment-frontend

# 2. Start development servers
npm run dev

# 3. Test payment frontend
# - Frontend: http://localhost:5173
# - Test stone purchase UI
# - Test subscription management
# - Test payment forms
# - Test purchase history
# - Test at 375×812 viewport

# 4. Run tests
npm test
npm run test:e2e --workspace=frontend

# 5. Run accessibility tests
npx playwright test --grep="accessibility"

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Stone purchase UI works perfectly
- Subscription management functional
- Payment forms are secure
- Purchase history viewable
- All payment frontend tests pass

---

## **LAYER 7: Admin Panel**
*Goal: Configuration and content management*

### 7.1 Admin Backend
**Branch**: `layer-7.1/admin-backend`

**Problem**: No admin system

**Tasks**:
1. Create admin authentication
2. Build config management APIs
3. Add feature flag management
4. Implement prompt versioning
5. Create admin API endpoints

**Acceptance Criteria**:
- ✅ Admin auth works
- ✅ Config management APIs
- ✅ Feature flag management
- ✅ Prompt versioning

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-7.1/admin-backend

# 2. Start development servers
npm run dev

# 3. Test admin backend
# - Backend: http://localhost:3000
# - Test admin authentication
# - Test config management APIs
# - Test feature flag management
# - Test prompt versioning

# 4. Test with API client
curl -X GET http://localhost:3000/api/admin/config
curl -X POST http://localhost:3000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"key": "test_flag", "enabled": true}'

# 5. Run tests
npm test --workspace=backend
npm run test:e2e --workspace=frontend

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Admin authentication works
- Config management APIs functional
- Feature flag management works
- Prompt versioning implemented
- All admin backend tests pass

---

### 7.2 Admin Frontend
**Branch**: `layer-7.2/admin-frontend`

**Problem**: No admin UI

**Tasks**:
1. Create admin dashboard
2. Build config management UI
3. Add feature flag toggles
4. Implement prompt editor
5. Create admin components

**Acceptance Criteria**:
- ✅ Admin dashboard works
- ✅ Config management UI
- ✅ Feature flag toggles
- ✅ Prompt editor functional

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-7.2/admin-frontend

# 2. Start development servers
npm run dev

# 3. Test admin frontend
# - Frontend: http://localhost:5173/admin
# - Test admin dashboard
# - Test config management UI
# - Test feature flag toggles
# - Test prompt editor
# - Test at 375×812 viewport

# 4. Run tests
npm test
npm run test:e2e --workspace=frontend

# 5. Run accessibility tests
npx playwright test --grep="accessibility"

# 6. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces
```

**Expected Outcome**:
- Admin dashboard works perfectly
- Config management UI functional
- Feature flag toggles work
- Prompt editor functional
- All admin frontend tests pass

---

## Quality Gates

Before moving to the next layer, ensure:

1. **All Tests Pass**: `npm test && npm run test:e2e`
2. **Accessibility**: 0 serious/critical axe violations
3. **Mobile**: Works perfectly at 375×812 viewport
4. **Linting**: No linting errors
5. **Type Checking**: No TypeScript errors
6. **Build**: Application builds successfully
7. **Documentation**: All docs updated
8. **Manual QA**: All functionality tested manually

## Branch Management

- Each layer gets its own branch
- Complete all tasks in the layer before moving to next
- Review and approve each layer before starting the next
- Merge to main only after layer is complete and tested

## Final State

After completing all layers, the application will have:

- ✅ Rock-solid foundation with proper testing
- ✅ Mobile-first responsive design with Tailwind
- ✅ Complete stone economy system
- ✅ Guest user authentication
- ✅ Turn-based AI gameplay
- ✅ Adventure and quest system
- ✅ Feature toggles and Dimensional Drifter
- ✅ Payment integration with Stripe
- ✅ Admin panel for configuration
- ✅ Full accessibility compliance
- ✅ Comprehensive test coverage
- ✅ Production-ready deployment

This plan ensures each layer is hardened and solid before moving to the next, following TDD principles and the established cursor rules.
