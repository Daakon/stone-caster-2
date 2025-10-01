# Stone Caster: Layer-by-Layer Implementation Plan

## Overview

This document tracks our systematic approach to hardening and building the Stone Caster application. Each layer must be completely solid before moving to the next, following TDD principles and the established cursor rules.

## Project Standards

- **Mobile-First**: All features tested at 375×812 before desktop
- **TDD**: Unit tests, E2E tests, and accessibility tests for every change
- **Quality Gates**: Linting, type-checking, and builds must pass
- **Documentation**: Update docs in same PR as code changes
- **Branch Strategy**: One branch per layer, complete before moving to next
- **Frameworks**: Backend Node/Express; Frontend React + Tailwind (no bespoke CSS)

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
- ✅ /api/config returns ETag and supports 304; hot-reload via config_meta.version verified by tests

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

**Problem**: Using custom CSS instead of specified Tailwind + shadcn/ui design system

**Tasks**:
1. **Complete Tailwind CSS Configuration**:
   - Verify `tailwind.config.js` has proper content paths and theme extensions
   - Add custom color palette for Stone Caster branding
   - Configure responsive breakpoints (mobile-first: 375px, 768px, 1024px, 1280px)
   - Set up typography scale and spacing system

2. **Install and Configure shadcn/ui**:
   - Initialize shadcn/ui with `npx shadcn@latest init`
   - Configure `components.json` with proper paths and styling
   - Install core components: Button, Input, Card, Dialog, DropdownMenu, Sheet
   - Install form components: Form, Label, Select, Textarea, Checkbox, RadioGroup
   - Install navigation components: NavigationMenu, Tabs, Breadcrumb
   - Install feedback components: Alert, Toast, Progress, Skeleton

3. **Migrate Existing CSS to Tailwind**:
   - Convert `frontend/src/index.css` to use only Tailwind directives
   - Remove custom CSS classes from all components
   - Replace inline styles with Tailwind utility classes
   - Ensure mobile-first responsive design (375×812 baseline)

4. **Create Base Component Library**:
   - Build reusable Button variants (primary, secondary, ghost, destructive)
   - Create form field components with proper labeling and validation states
   - Build card components for character/game displays
   - Create navigation components (header, sidebar, mobile drawer)
   - Build modal/dialog components for confirmations and forms

5. **Implement Dark Mode Support**:
   - Configure Tailwind dark mode with `class` strategy
   - Create dark mode toggle component
   - Define dark mode color palette
   - Test all components in both light and dark modes
   - Ensure proper contrast ratios for accessibility

6. **Mobile Navigation System**:
   - Implement hamburger menu for mobile (375×812)
   - Create slide-out drawer navigation
   - Add touch-friendly tap targets (44px minimum)
   - Implement swipe gestures for mobile navigation
   - Test on actual mobile devices

7. **Accessibility Enhancements**:
   - Ensure all interactive elements have proper focus states
   - Add ARIA labels and descriptions where needed
   - Test keyboard navigation through all components
   - Verify color contrast meets WCAG AA standards
   - Add screen reader support for dynamic content

**Acceptance Criteria**:
- ✅ All pages use Tailwind utility classes exclusively
- ✅ shadcn/ui components properly installed and configured
- ✅ Mobile-first responsive design works at 375×812 and up
- ✅ Dark mode toggle functional with proper theming
- ✅ No custom CSS files (only Tailwind directives in index.css)
- ✅ Mobile navigation drawer works with touch gestures
- ✅ All components pass accessibility tests (axe-core)
- ✅ Keyboard navigation works throughout the app
- ✅ Color contrast meets WCAG AA standards
- ✅ Components are reusable and properly typed

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-0.2/tailwind-shadcn-setup

# 2. Install dependencies (if not already done)
npm install

# 3. Initialize shadcn/ui (if not already done)
cd frontend
npx shadcn@latest init
# Follow prompts to configure components.json

# 4. Install shadcn/ui components
npx shadcn@latest add button input card dialog dropdown-menu sheet
npx shadcn@latest add form label select textarea checkbox radio-group
npx shadcn@latest add navigation-menu tabs breadcrumb
npx shadcn@latest add alert toast progress skeleton

# 5. Start development servers
cd ..
npm run dev

# 6. Test the application
# - Frontend: http://localhost:5173
# - Backend: http://localhost:3000/health

# 7. Visual Testing Checklist:
# - Verify all pages use Tailwind classes exclusively
# - Test responsive design at 375×812 (mobile), 768×1024 (tablet), 1920×1080 (desktop)
# - Test dark mode toggle functionality
# - Verify shadcn/ui components render correctly
# - Check mobile navigation drawer works with touch
# - Test keyboard navigation (Tab, Enter, Escape, Arrow keys)
# - Verify focus states are visible and logical
# - Check color contrast in both light and dark modes
# - Test form validation states and error messages
# - Verify loading states and animations work

# 8. Accessibility Testing:
# - Run axe-core tests: npm run test:a11y --workspace=frontend
# - Test with screen reader (if available)
# - Verify all interactive elements are keyboard accessible
# - Check that color is not the only way to convey information

# 9. Run tests
npm test
npm run test:e2e --workspace=frontend

# 10. Run linting and type checking
npm run lint --workspaces
npm run type-check --workspaces

# 11. Build test
npm run build
```

**Expected Outcome**:
- All pages styled with Tailwind utility classes exclusively
- shadcn/ui components properly integrated and functional
- Mobile-first responsive design working at all breakpoints
- Dark mode toggle working with proper theming
- Mobile navigation drawer functional with touch support
- All accessibility tests passing (0 serious/critical axe violations)
- Keyboard navigation working throughout the application
- No custom CSS files (only Tailwind directives)
- Components are reusable, properly typed, and documented

---

### 0.3 Accessibility & Testing Infrastructure
**Branch**: `layer-0.3/accessibility-testing`

**Problem**: Missing comprehensive accessibility testing and component library completion

**Tasks**:
1. **Install and Configure Accessibility Testing**:
   - Install @axe-core/playwright for automated accessibility testing
   - Configure Playwright with accessibility test suite
   - Set up axe-core rules and configuration
   - Create accessibility test utilities and helpers

2. **Complete Component Library**:
   - Build additional reusable components: Badge, Avatar, Separator, ScrollArea
   - Create form validation components with proper error states
   - Build loading states and skeleton components
   - Create toast notification system with Sonner
   - Build modal/dialog components for confirmations and forms
   - Create data display components: Table, List, Accordion

3. **Accessibility Enhancements**:
   - Ensure all interactive elements have proper focus states
   - Add ARIA labels and descriptions where needed
   - Implement proper heading hierarchy (h1, h2, h3, etc.)
   - Add skip navigation links for keyboard users
   - Ensure color contrast meets WCAG AA standards
   - Add screen reader support for dynamic content
   - Implement proper form labeling and error associations

4. **Responsive Design Testing**:
   - Create comprehensive responsive test suite
   - Test at all breakpoints: 375×812, 768×1024, 1024×768, 1920×1080
   - Verify mobile-first approach works correctly
   - Test touch interactions and gestures
   - Ensure proper viewport handling

5. **Keyboard Navigation**:
   - Implement comprehensive keyboard navigation
   - Add focus management for modals and drawers
   - Ensure tab order is logical and intuitive
   - Add keyboard shortcuts for common actions
   - Test with keyboard-only navigation

6. **Testing Infrastructure**:
   - Add unit tests for all new components
   - Create integration tests for user flows
   - Add visual regression tests for components
   - Set up automated accessibility testing in CI
   - Create test utilities for common patterns

**Acceptance Criteria**:
- ✅ @axe-core/playwright installed and configured
- ✅ 0 serious/critical accessibility violations on all pages
- ✅ All components have proper ARIA labels and focus states
- ✅ Color contrast meets WCAG AA standards (4.5:1 ratio)
- ✅ Keyboard navigation works throughout the application
- ✅ Screen reader compatible with proper announcements
- ✅ Responsive design tested at all breakpoints
- ✅ Comprehensive component library with 15+ reusable components
- ✅ Form validation with proper error states and associations
- ✅ Loading states and skeleton components implemented
- ✅ Toast notification system functional
- ✅ Modal/dialog system with proper focus management
- ✅ All components have unit tests with 80%+ coverage
- ✅ Integration tests for critical user flows
- ✅ Visual regression tests for component library

**Local Testing Instructions**:
```bash
# 1. Checkout the branch
git checkout layer-0.3/accessibility-testing

# 2. Install dependencies
npm install

# 3. Install additional shadcn/ui components
cd frontend
npx shadcn@latest add badge avatar separator scroll-area --yes
npx shadcn@latest add table accordion --yes

# 4. Start development servers
cd ..
npm run dev

# 5. Accessibility Testing:
# - Frontend: http://localhost:5173
# - Run automated accessibility tests:
npm run test:a11y --workspace=frontend
# - Manual testing with screen reader (VoiceOver/NVDA)
# - Test keyboard-only navigation (Tab, Enter, Escape, Arrow keys)
# - Verify focus indicators are visible and logical
# - Check color contrast with browser dev tools

# 6. Responsive Design Testing:
# - Test at 375×812 (iPhone X baseline)
# - Test at 768×1024 (iPad portrait)
# - Test at 1024×768 (iPad landscape)
# - Test at 1920×1080 (Desktop)
# - Verify mobile-first approach works correctly
# - Test touch interactions and gestures

# 7. Component Library Testing:
# - Test all new components in Storybook (if available)
# - Verify form validation states and error messages
# - Test loading states and skeleton components
# - Test toast notifications
# - Test modal/dialog focus management
# - Test data display components

# 8. Run comprehensive test suite:
npm test
npm run test:e2e --workspace=frontend
npm run test:a11y --workspace=frontend

# 9. Run linting and type checking:
npm run lint --workspaces
npm run type-check --workspaces

# 10. Build test:
npm run build
```

**Expected Outcome**:
- Comprehensive accessibility testing infrastructure in place
- 0 serious/critical accessibility violations across all pages
- Complete component library with 15+ reusable components
- Full keyboard navigation support with proper focus management
- Screen reader compatible with proper ARIA implementation
- Responsive design tested and working at all breakpoints
- Form validation with proper error states and associations
- Loading states, skeleton components, and toast notifications
- Modal/dialog system with proper focus management
- Comprehensive test coverage (unit, integration, accessibility, visual)
- All components properly typed and documented

---

### 0.4 Complete Backend API Validation
**Branch**: `layer-0.4/api-validation`

**Problem**: Missing Zod validation on all endpoints and incomplete wrapper architecture

**Tasks**:
1. **API Validation & Error Handling**:
   - Add Zod schemas for all request/response types
   - Implement consistent error response format
   - Add proper JWT authentication middleware
   - Ensure all endpoints return `{ ok, data?, error? }` format
   - Add comprehensive API documentation

2. **Wrapper Architecture Implementation**:
   - Complete wrapper modules: /wrappers/ai, /wrappers/auth, /wrappers/payments
   - Move all vendor SDK imports to wrapper modules
   - Add tests ensuring no vendor SDKs are imported outside wrappers
   - Implement proper error handling and logging in wrappers
   - Add wrapper-specific configuration and environment handling

3. **API Security & Performance**:
   - Implement rate limiting for API endpoints
   - Add request/response logging and monitoring
   - Implement proper CORS configuration
   - Add API versioning support
   - Implement request validation middleware

**Acceptance Criteria**:
- ✅ All API inputs validated with Zod schemas
- ✅ Consistent error response format across all endpoints
- ✅ JWT authentication middleware working correctly
- ✅ All vendor SDK imports moved to wrapper modules
- ✅ Wrapper architecture tests passing (no violations)
- ✅ No `any` types in API code
- ✅ All endpoints documented with OpenAPI/Swagger
- ✅ Rate limiting implemented and tested
- ✅ CORS configuration properly set up
- ✅ Request/response logging and monitoring in place

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
- All API endpoints validate input with Zod schemas
- Consistent error response format across all endpoints
- JWT authentication middleware working correctly
- Complete wrapper architecture with no vendor SDK violations
- All vendor SDK imports properly isolated in wrapper modules
- No TypeScript `any` types in API code
- Comprehensive API documentation with OpenAPI/Swagger
- Rate limiting and security measures in place
- Request/response logging and monitoring implemented
- All API tests passing with comprehensive coverage

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
6. Create tag join tables and indexes:
   - world_tags(world_id, tag_id), adventure_tags(adventure_id, tag_id),
     scenario_tags(scenario_id, tag_id), quest_tags(quest_id, tag_id),
     character_tags(character_id, tag_id)

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
- ✅ Every stone mutation (spend, grant, convert, purchase, regen) writes an immutable stone_ledger entry with {owner, delta, reason, game_id?, turn_id?}

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
6. Implement cookie groups: cookie_groups, cookie_group_members
7. Implement guest shared wallet at group level (guest_stone_wallets) and device membership
8. Internal linking on auth callback (cookie group -> user), with merge rules

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
- ✅ Prompt assembly occurs server-side only; full game state and prompt content never leave the server
- ✅ All responses pass through a DTO mapper; internal fields (e.g., state snapshots, internal IDs, audit data) are redacted
- ✅ Unit tests verify DTO redaction; integration tests ensure forbidden fields never appear in HTTP responses

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
- ✅ UI functions with DTOs only; no client-side prompt composition or access to full state

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
1. Implement payment operations via /wrappers/payments (Stripe behind wrapper)
2. Add subscription management
3. Ensure webhooks flow through the wrapper; no direct SDK in API/routes/services
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
4. Implement prompt versioning and management for Worlds, Scenarios, Adventures, and Quests; store version, hash, active flag
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
