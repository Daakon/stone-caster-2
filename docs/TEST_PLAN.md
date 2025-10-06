# Stone Caster Test Plan

## Overview

This document outlines the comprehensive test plan for Stone Caster, covering all layers from P0 (Guest Play Flow) through M6 (Profiles & Account Safety). Each layer builds upon previous functionality with comprehensive testing coverage.

## Layer P0 - Guest Play Flow Tests

### Overview
Layer P0 focuses on enabling guest users to play the game without authentication barriers. This includes guest authentication, game spawning, turn submission, and stone management.

### Test Objectives
- Verify guest users can spawn games without authentication
- Test guest turn submission and AI response handling
- Validate guest wallet operations and stone spending
- Ensure proper error handling for insufficient stones
- Test guest session persistence across page refreshes
- Verify mobile-first design and accessibility compliance

### Backend Unit Tests

#### Layer P0 Regression Tests
- **File:** `backend/src/routes/layer-p0-regression.test.ts`
- **Coverage:**
  - Guest authentication fixes in games route
  - Guest wallet transaction handling
  - Guest spawn->turn loop integration
  - Insufficient stones error handling
- **Test Scenarios:**
  - Guest can fetch game by ID without 401 error
  - Guest spawn flow works end-to-end
  - Guest stone spending uses correct wallet method
  - Insufficient stones error for guest users
  - Complete guest spawn->turn loop success
  - Insufficient stones in turn flow handling

#### Wallet Service Tests
- **File:** `backend/src/services/wallet.service.test.ts`
- **Coverage:**
  - `spendCastingStones()` with guest parameter
  - Guest wallet creation and management
  - Stone ledger recording for guest transactions
- **Test Scenarios:**
  - Guest stone spending with proper wallet method
  - Guest wallet creation on first spawn
  - Ledger entries for guest transactions
  - Insufficient stones error handling

#### Games Service Tests
- **File:** `backend/src/services/games.service.test.ts`
- **Coverage:**
  - Guest game spawning
  - Guest game fetching
  - Starter stones grant for guests
- **Test Scenarios:**
  - Guest game spawn with starter stones
  - Guest game retrieval
  - Starter stones grant logic

### Frontend E2E Tests

#### Layer P0 Guest Play Flow Tests
- **File:** `frontend/e2e/layer-p0-guest-play-flow.spec.ts`
- **Coverage:**
  - Complete guest spawn->turn loop through `/play/:gameId`
  - Insufficient stones error handling
  - Guest session persistence
  - Mobile viewport compatibility
- **Test Scenarios:**
  - Guest can complete spawn->turn loop successfully
  - Insufficient stones error displayed gracefully
  - Guest session maintained across page refreshes
  - Mobile viewport (375x812) compatibility
  - No redirect to auth pages during guest play

#### Guest Stone Handling Tests
- **File:** `frontend/e2e/guest-stone-handling.spec.ts`
- **Coverage:**
  - Guest stone consumption without route redirect
  - Guest stone action logging
  - Adventure flow without authentication barriers
- **Test Scenarios:**
  - Guest can begin adventure with sufficient stones
  - Sign-in CTA when guest has insufficient stones
  - Guest stone actions logged in console
  - Stone consumption without auth redirect

### Integration Tests

#### Turn Engine Integration Tests
- **File:** `backend/src/routes/turn-engine-integration.test.ts`
- **Coverage:**
  - Guest spawn with device cookie
  - Guest turn processing
  - Stone economy flow for guests
- **Test Scenarios:**
  - Guest spawn with device cookie
  - Guest turn submission and AI response
  - Stone spending and balance updates

#### Games API Integration Tests
- **File:** `backend/src/routes/games.integration.test.ts`
- **Coverage:**
  - Guest game spawning
  - Guest game fetching
  - Error handling for guest users
- **Test Scenarios:**
  - Guest game spawn success
  - Guest game retrieval
  - Validation errors for guest requests

### Accessibility Tests

#### Axe Core Testing
- **Coverage:** All guest play flow pages
- **Requirements:** 0 serious/critical violations
- **Pages Tested:**
  - Adventure character selection
  - Game play page (`/play/:gameId`)
  - Error pages (insufficient stones)
- **Test Scenarios:**
  - Mobile viewport (375x812) accessibility
  - Desktop viewport accessibility
  - Keyboard navigation
  - Screen reader compatibility

### Performance Tests

#### Guest Flow Performance
- **Coverage:** Guest spawn->turn loop performance
- **Metrics:**
  - Game spawn response time < 2s
  - Turn submission response time < 5s
  - Page load time < 3s on mobile
- **Test Scenarios:**
  - Guest spawn performance
  - Turn submission performance
  - Page refresh performance

## Layer M6 - Profiles & Account Safety Tests

## Overview

This section covers Layer M6 - Profiles & Account Safety, focusing on secure profile management, guest-to-auth upgrades, session safety, and account controls. Layer M6 builds upon Layer M5's observability features with comprehensive user account management and security.

## Test Objectives

- Verify secure profile management with CSRF protection and validation
- Test guest-to-auth upgrade flow with data preservation and idempotency
- Validate session safety controls including revocation and CSRF tokens
- Ensure gated route access control with proper authentication flows
- Test profile UI accessibility and mobile-first design
- Verify error handling with actionable messages and traceIds
- Ensure authenticated sessions hydrate profile data exactly once per login to prevent duplicate API calls
- Validate comprehensive testing coverage for all new functionality
- Test non-regression scenarios for existing functionality

## Unit Tests

### Auth Flow Fixes Tests

#### AuthRouter Component Tests
- **File:** `frontend/src/components/AuthRouter.test.tsx`
- **Coverage:**
  - Guest user authentication status logging
  - Authenticated user redirect behavior
  - Guest user staying on auth pages (no redirect)
  - Loading state handling
  - Redirect fallback to `location.state.from`
  - Store transition from guest→authenticated after initial render
  - Double navigation prevention with redirect guard
- **Test Scenarios:**
  - Guest users can stay on `/auth/signin` without being redirected
  - Authenticated users are redirected away from auth pages
  - Proper logging of authentication status
  - No redirects during loading state
  - Fallback to `location.state.from` when no intended route preserved
  - Fallback to home (`/`) when no intended route or state.from
  - Redirect guard prevents double navigation on re-renders
  - Store selector-based re-rendering on auth state changes

#### Auth Store Initialization Tests
- **File:** `frontend/src/store/__tests__/authStore.initialize.test.ts`
- **Coverage:**
  - Subscription timing to catch early OAuth callback notifications
  - Early SIGNED_IN notification handling during initialization
  - State synchronization from `getCurrentUser()` after initialization
  - Single subscription registration on multiple initialize calls
  - Error handling during initialization
  - Subscription callback updates for auth state changes
- **Test Scenarios:**
  - Subscription registered before `authService.initialize()` call
  - Early SIGNED_IN notifications captured during OAuth callback
  - Store state synced from `getCurrentUser()` when service already authenticated
  - Multiple initialize calls only register subscription once
  - Initialization errors handled gracefully with fallback to guest state
  - Subscription callbacks properly update store state

#### Wallet Service Tests
- **File:** `frontend/src/services/wallet.test.ts`
- **Coverage:**
  - `getWallet()` - wallet data retrieval for guests and authenticated users
  - Error handling for network failures
  - API response parsing and validation
- **Test Scenarios:**
  - Successful wallet data retrieval
  - Network error handling
  - API error response handling
  - Guest user wallet access

### Layer M6: Profile Service Tests
- **File:** `frontend/src/services/profile.test.ts`
- **Coverage:**
  - `checkAccess()` - profile access validation and guest detection
  - `getProfile()` - profile data retrieval and error handling
  - `updateProfile()` - profile updates with validation
  - `generateCSRFToken()` - CSRF token generation for security
  - `revokeOtherSessions()` - session revocation with CSRF validation
  - `linkGuestAccount()` - guest account linking with idempotency
- **Test Scenarios:**
  - Successful profile operations
  - Authentication failures and access denied
  - CSRF token validation and expiration
  - Guest account linking success and conflicts
  - Network errors and retry logic

### Layer M6: Guest Linking Service Tests
- **File:** `frontend/src/services/guestLinking.test.ts`
- **Coverage:**
  - `linkGuestAccount()` - guest account linking flow
  - `hasGuestAccountToLink()` - guest cookie detection
  - `getGuestCookieId()` - guest cookie retrieval
  - `clearGuestCookie()` - guest cookie cleanup
- **Test Scenarios:**
  - Successful guest account linking
  - Already linked account handling
  - No guest cookie scenarios
  - Linking failures and error handling
  - Cookie cleanup after successful linking

### Layer M6: Gated Route Component Tests
- **File:** `frontend/src/components/auth/GatedRoute.test.tsx`
- **Coverage:**
  - `GatedRoute` component - access control and routing
  - `useGatedAccess` hook - access state management
  - Authentication requirement handling
  - Guest user redirection and messaging
  - Error state handling and fallbacks
- **Test Scenarios:**
  - Authenticated user access
  - Guest user redirection
  - Access check failures
  - Loading states and error handling
  - Custom fallback rendering

### Layer M5: Telemetry Service Tests
- **File:** `frontend/src/services/telemetry.test.ts`
- **Coverage:**
  - `initialize()` - config loading and validation
  - `shouldRecord()` - sampling logic and feature flag checks
  - `recordEvent()` - event queuing and batch processing
  - `trackTurnStarted()` - turn initiation tracking
  - `trackTurnCompleted()` - success tracking with duration
  - `trackTurnFailed()` - error tracking with error codes
  - `trackSpawnSuccess()` - game spawn success tracking
  - `trackSpawnConflict()` - spawn conflict tracking
  - `trackGuestToAuthMerge()` - user upgrade tracking
  - `trackPurchaseAttempt()` - purchase initiation tracking
  - `trackPurchaseSuccess()` - purchase completion tracking
  - `trackPurchaseFailed()` - purchase failure tracking
  - `trackErrorShown()` - error display tracking
  - `trackRetryAttempted()` - retry action tracking
  - `trackGameLoaded()` - load time tracking
  - Error handling - graceful API failure handling
  - Queue processing - batch event submission
  - Configuration - telemetry toggle behavior

### Layer M5: Enhanced Error Banner Tests
- **File:** `frontend/src/components/ui/error-banner.test.tsx`
- **Coverage:**
  - TraceId display and copy functionality
  - Actionable error messages with proper CTAs
  - Wallet navigation for insufficient stones
  - Help system integration
  - Retry functionality with loading states
  - Dismiss functionality
  - Accessibility attributes and ARIA labels
  - Mobile and desktop layouts
  - Error code specific behavior

### Turn Error Handler Component Tests
- **File:** `frontend/src/components/gameplay/TurnErrorHandler.test.tsx`
- **Coverage:**
  - Insufficient stones error display and actions
  - Timeout error with retry guidance
  - Validation error with action suggestions
  - Network error with connection troubleshooting
  - Idempotency error with wait guidance
  - Generic error fallback handling
  - Retry functionality with loading states
  - Help functionality and navigation
  - Accessibility attributes and ARIA labels

### Mobile Drawer Navigation Tests
- **File:** `frontend/src/components/layout/MobileDrawerNav.test.tsx`
- **Coverage:**
  - Mobile header with hamburger menu
  - Drawer slide-out functionality
  - Navigation item highlighting
  - Stone balance display
  - User authentication states
  - Desktop sidebar layout
  - Responsive breakpoint behavior
  - Keyboard navigation support

### Unified Game Page Tests
- **File:** `frontend/src/pages/UnifiedGamePage.test.tsx`
- **Coverage:**
  - Game data loading with React Query
  - Character and world data integration
  - Turn submission with error handling
  - History feed updates
  - Stone balance updates
  - World rules display
  - Loading and error states
  - Mobile and desktop layouts

## Integration Tests

### Layer M6: Profile API Integration Tests
- **File:** `backend/src/routes/profile.integration.test.ts`
- **Coverage:**
  - `GET /api/profile/access` - access control validation
  - `GET /api/profile` - profile data retrieval
  - `PUT /api/profile` - profile updates with CSRF protection
  - `POST /api/profile/csrf-token` - CSRF token generation
  - `POST /api/profile/revoke-sessions` - session revocation
  - `POST /api/profile/link-guest` - guest account linking
- **Test Scenarios:**
  - Authenticated user profile operations
  - Guest user access restrictions
  - CSRF token validation and expiration
  - Session revocation with proper cleanup
  - Guest account linking with idempotency
  - Rate limiting and security controls
  - Error handling and validation

### Layer M5: Telemetry Endpoint Tests
- **File:** `backend/src/routes/telemetry.integration.test.ts`
- **Coverage:**
  - `POST /api/telemetry/event` - basic telemetry event recording
  - `POST /api/telemetry/gameplay` - gameplay-specific telemetry events
  - `GET /api/telemetry/config` - telemetry configuration endpoint
  - Rate limiting - prevent spam and abuse
  - Feature flag integration - respect telemetry_enabled setting
  - Sampling rate - proper sampling behavior
  - User context - guest vs authenticated user handling
  - Error handling - graceful failure without breaking user flow
  - Validation - proper request validation with Zod schemas
  - Response format - consistent response envelope with traceId

### Turn Endpoint Tests
- **File:** `backend/src/routes/games.turn.integration.test.ts`
- **Coverage:**
  - Authentication requirements
  - Request validation (game ID, option ID, idempotency key)
  - Successful turn execution
  - Error handling:
    - Insufficient stones (402)
    - Game not found (404)
    - AI validation error (422)
    - AI timeout (504)
    - Internal server error (500)
  - Idempotency behavior - same key returns same response
  - Response envelope format with trace ID
  - Structured logging - proper log entries with traceId and context

### Database Integration Tests
- **Coverage:**
  - Turn record creation in `turns` table
  - Idempotency record storage in `idempotency_keys` table
  - Stone wallet updates and ledger entries
  - Game state updates

## QA Testing Scenarios

### Layer M6: Profile Management Scenarios

#### Profile Access Control Testing
1. **Guest User Profile Access**
   - Navigate to `/profile` as guest user
   - Verify "Authentication Required" message appears
   - Confirm "Sign In" button is present and functional
   - Verify guest-specific messaging about account benefits
   - Test "Back to Home" navigation

2. **Authenticated User Profile Access**
   - Sign in with valid credentials
   - Navigate to `/profile`
   - Verify profile data loads correctly
   - Confirm all profile sections are visible
   - Test responsive layout on mobile (375×812px)

#### Profile Management Testing
3. **Profile Editing Flow**
   - Click "Edit" button on profile page
   - Modify display name and avatar URL
   - Test form validation (empty name, invalid URL)
   - Save changes and verify success message
   - Cancel changes and verify reversion
   - Test CSRF token handling

4. **Session Management Testing**
   - Access session management section
   - Click "Revoke Other Sessions" button
   - Verify confirmation message and session count
   - Test CSRF token validation
   - Verify current session remains active

#### Guest Account Linking Testing
5. **Guest to Auth Upgrade Flow**
   - Start as guest user with active games/characters
   - Sign in with valid credentials
   - Verify guest account linking happens automatically
   - Confirm all guest data is preserved
   - Test idempotent linking (repeat sign-in)
   - Verify guest cookie cleanup after linking

6. **Guest Linking Error Scenarios**
   - Test linking when no guest account exists
   - Test linking when account already linked
   - Test linking with network failures
   - Verify appropriate error messages and recovery

### Layer M5: Self-Serve QA Runbook

#### Guest User Happy Path
1. **Setup**: Open browser in incognito mode
2. **Navigate**: Go to Stone Caster homepage
3. **Create Character**: Use character creation flow
4. **Start Adventure**: Select world and begin game
5. **Take Turns**: Submit 2-3 turns successfully
6. **Verify**: Check telemetry events in browser dev tools
7. **Capture**: Screenshot of successful gameplay

#### Authenticated User Upgrade Flow
1. **Setup**: Start as guest user (follow guest happy path)
2. **Sign Up**: Create account and sign in
3. **Verify Merge**: Confirm guest data is preserved
4. **Continue Game**: Take additional turns
5. **Check Telemetry**: Verify guest_to_auth_merge event
6. **Capture**: Screenshot of merged user state

#### Insufficient Stones Scenario
1. **Setup**: Use account with low stone balance
2. **Attempt Turn**: Try to take turn that costs more stones than available
3. **Verify Error**: Check error banner shows "Go to Wallet" button
4. **Check TraceId**: Verify traceId is displayed and copyable
5. **Navigate Wallet**: Click "Go to Wallet" button
6. **Purchase Stones**: Complete stone purchase flow
7. **Return to Game**: Resume turn submission
8. **Capture**: Screenshot of error state and recovery

#### Turn Replay Scenario
1. **Setup**: Start a game and take a turn
2. **Duplicate Request**: Submit same turn again (simulate network retry)
3. **Verify Idempotency**: Check that duplicate is handled gracefully
4. **Check Logs**: Verify idempotency is logged with traceId
5. **Capture**: Screenshot of idempotency handling

#### Conflict Resume Scenario
1. **Setup**: Start game, then start another game with same character
2. **Verify Conflict**: Check that conflict error is shown
3. **Resume Original**: Click "Resume Game" button
4. **Verify Navigation**: Confirm return to original game
5. **Check Telemetry**: Verify spawn_conflict event recorded
6. **Capture**: Screenshot of conflict resolution

#### Telemetry Configuration Testing
1. **Check Config**: Visit `/api/telemetry/config` endpoint
2. **Verify Settings**: Confirm telemetry enabled/disabled status
3. **Toggle Settings**: Use admin panel to change telemetry settings
4. **Test Events**: Submit telemetry events and verify recording
5. **Check Sampling**: Verify sampling rate behavior
6. **Capture**: Screenshot of telemetry configuration

#### Error Reporting Workflow
1. **Trigger Error**: Cause a deliberate error (e.g., invalid request)
2. **Check Error Banner**: Verify error message and traceId display
3. **Copy TraceId**: Use copy button to copy traceId
4. **Report Issue**: Paste traceId into bug report template
5. **Verify Logs**: Check backend logs for matching traceId
6. **Capture**: Screenshot of error state with traceId

## End-to-End Tests

### Auth Flow Fixes E2E Tests
- **File:** `frontend/e2e/auth-flow-fixes.spec.ts`
- **Coverage:**
  - Guest users can stay on sign-in page without redirecting
  - Wallet balance display for guests
  - Play route navigation with characterId
  - Password field autocomplete attributes
  - Successful sign-in flow handling
- **Test Scenarios:**
  - Navigate to `/auth/signin` and verify no redirect back to landing page
  - Verify wallet balance is accessible for guest users
  - Test `/play/:characterId` route resolves without 404 errors
  - Check password fields have proper autocomplete attributes
  - Test sign-in form submission doesn't cause redirect loops

### OAuth Flow E2E Tests
- **File:** `frontend/e2e/oauth-flow.spec.ts`
- **Coverage:**
  - Google OAuth flow completion and authenticated state
  - OAuth callback handling with search parameters
  - OAuth callback handling with hash fragments
  - Intended route preservation after OAuth
  - OAuth error handling
  - Guest wallet access during OAuth flow
- **Test Scenarios:**
  - Complete Google OAuth flow and verify authenticated state
  - Handle OAuth callback with URL search parameters
  - Handle OAuth callback with URL hash fragments
  - Preserve intended route after successful OAuth
  - Handle OAuth errors gracefully
  - Maintain guest wallet access during OAuth flow

### Layer M6: Profile and Session Management E2E Tests
- **File:** `frontend/e2e/profile-and-session.spec.ts`
- **Coverage:**
  - Profile access control and authentication requirements
  - Profile management (view, edit, save, cancel)
  - Session management (revoke other sessions)
  - Guest account linking after authentication
  - Error handling and recovery flows
  - Accessibility compliance and screen reader support
- **Test Scenarios:**
  - Guest user profile access restrictions
  - Authenticated user profile management
  - Profile editing with validation
  - Session revocation with confirmation
  - Guest account linking success and conflicts
  - Error states and recovery actions
  - Mobile and desktop responsive behavior
  - Accessibility features and keyboard navigation

### Layer M5: Observability E2E Tests
- **File:** `frontend/e2e/observability.spec.ts`
- **Coverage:**
  - Telemetry configuration endpoint accessibility
  - Error banner traceId display and copy functionality
  - Telemetry event recording during gameplay
  - Error handling with actionable messages
  - Mobile and desktop error state consistency
  - Accessibility compliance for error states

### Unified Game E2E Tests
- **File:** `frontend/e2e/unified-game.spec.ts`
- **Coverage:**

#### Mobile-First Design (375×812)
- Unified game interface display on mobile
- Turn submission and result display
- Error handling with recovery actions
- Mobile navigation with hamburger menu
- Touch-friendly interface elements
- Responsive layout behavior

#### Desktop Layout (≥1024px)
- Three-column grid layout
- Persistent sidebar navigation
- Desktop-specific interactions
- Keyboard navigation support
- Window resize handling

#### Turn Loop Testing
- Complete turn submission flow
- Real-time history updates
- Stone balance tracking
- Turn count increments
- World rule updates
- Error state recovery

#### Error Handling Scenarios
- Insufficient stones with wallet navigation
- Timeout errors with retry guidance
- Validation errors with action suggestions
- Network errors with connection troubleshooting
- Idempotency errors with wait guidance

#### Accessibility Testing
- ARIA labels and semantic HTML
- Keyboard navigation flow
- Screen reader compatibility
- Focus management
- Color contrast compliance
- Touch target sizing

#### Cross-Platform Testing
- Responsive breakpoint transitions
- Data consistency across viewports
- Error handling consistency
- Performance across devices

## Test Data Requirements

### Live API Data
- Game DTOs with turn count and adventure information
- Character DTOs with world data and metadata
- World content DTOs with rules and display settings
- Wallet DTOs with stone balance and currency
- Turn DTOs with narrative, choices, and state updates

### Test Scenarios
- **Happy Path:** Live data loading, successful turn submission, real-time updates
- **Insufficient Stones:** Low balance, error handling with wallet navigation
- **API Timeout:** Network delay, retry mechanisms, user guidance
- **Validation Errors:** Invalid actions, error messages, recovery suggestions
- **Idempotency:** Duplicate requests, cached responses, user feedback
- **Mobile/Desktop:** Responsive behavior, navigation differences, touch vs keyboard

## Performance Tests

### Mobile Performance
- Page load time on mobile devices (target: <3 seconds)
- Touch response time (target: <100ms)
- Scroll performance and smoothness
- Memory usage on mobile browsers
- Battery impact during extended play

### Desktop Performance
- Page load time on desktop (target: <2 seconds)
- Keyboard response time (target: <50ms)
- Window resize performance
- Multi-tab performance
- CPU usage during gameplay

### API Performance
- Turn execution time (target: <5 seconds)
- Data loading time (target: <1 second)
- Cache hit rates for repeated requests
- Error response time (target: <2 seconds)

### Concurrent Testing
- Multiple users taking turns simultaneously
- Idempotency key collision handling
- Database lock contention
- Mobile and desktop users mixed

## Security Tests

### Authentication & Authorization
- Unauthenticated requests are rejected
- Users can only take turns in their own games
- Idempotency keys are properly scoped to users

### Input Validation
- Malformed request bodies are rejected
- Invalid UUIDs are rejected
- SQL injection attempts are blocked

## Accessibility Tests

### WCAG Compliance
- All interactive elements are keyboard accessible
- Screen reader compatibility for turn results and error messages
- Color contrast meets WCAG AA standards
- Focus management during turn execution and navigation
- ARIA labels and semantic HTML structure
- Skip links for navigation efficiency

### Mobile Accessibility
- Touch targets are 44px minimum (WCAG AA)
- Turn interface works on mobile devices with assistive technology
- Error messages are clearly visible and announced
- Gesture support for navigation
- Voice control compatibility

### Desktop Accessibility
- Full keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus indicators and management
- Keyboard shortcuts for power users

## Test Execution

### Local Development
```bash
# Frontend unit tests
cd frontend && npm test

# Frontend E2E tests
cd frontend && npm run test:e2e

# Backend unit tests
cd backend && npm test

# Backend integration tests
cd backend && npm run test:integration

# Accessibility tests
cd frontend && npm run test:a11y
```

### CI/CD Pipeline
- All tests must pass before deployment
- Coverage thresholds: 80% for unit tests, 60% for integration tests
- E2E tests run on staging environment with mobile and desktop viewports
- Accessibility tests run with axe-core on all critical user flows

## Test Environment Setup

### Database
- Separate test database with migrations
- Seed data for consistent test runs
- Cleanup between test suites

### External Services
- Mock AI service responses
- Mock authentication service
- Mock stone wallet service

### Test Data Cleanup
- Automatic cleanup of test records
- Reset of stone balances
- Clear idempotency records

## Acceptance Criteria Verification

### ✅ Layer M6: Profile Management
- **Profile API & UI**: ✅ Authenticated profile read returns current state; unauthenticated requests blocked with REQUIRES_AUTH error
- **Profile Updates**: ✅ Validation enforced (name length, avatar URL, theme choices) with CSRF token requirements
- **UI Feedback**: ✅ Success/error messages displayed; inline validation prevents obvious mistakes
- **Guest Linking Flow**: ✅ Guest data linked to Supabase user exactly once; idempotent operation with single LINK_MERGE ledger entry
- **Gated Actions**: ✅ Guest access to gated routes returns REQUIRES_AUTH with sign-in prompt; seamless access after authentication
- **Session Revocation & CSRF**: ✅ CSRF token generation and validation; session revocation with clear messaging
- **Testing & Docs**: ✅ Comprehensive test coverage; updated documentation with QA guidance
- **Accessibility & Error Handling**: ✅ Profile UI fully accessible; 0 serious/critical axe issues; error banners include traceId

### ✅ Layer M5: Structured Logging
- [x] All player-facing actions leave structured logs with traceIds
- [x] Logs include route, status, latency, and meaningful context
- [x] Error logs show error code, message, and traceId without raw stack traces
- [x] Request traceIds are included in response headers

### ✅ Layer M5: Configurable Telemetry
- [x] Telemetry can be toggled via config/env (off in local dev, on for QA)
- [x] Events cover: turn success/failure, spawn success/conflict, guest→auth merge, purchase attempts
- [x] Payloads exclude PII and internal secrets
- [x] Events capture only what QA needs (event type, owner kind, traceId, metadata)

### ✅ Layer M5: Enhanced Error Handling
- [x] UI surfaces actionable copy for failures (e.g., "Casting Stones are low—see wallet")
- [x] Error cards include traceId (copyable) for bug reports
- [x] Buttons/link back to retry flows and help systems
- [x] Error states are mobile-first and accessible

### ✅ Layer M5: Self-Serve QA
- [x] Step-by-step QA scenarios in TEST_PLAN.md and UX_FLOW.md
- [x] Runbook explains how to retrieve logs/telemetry
- [x] Clear instructions for what to screenshot/copy for bug reports
- [x] Telemetry configuration endpoint for QA testing

### ✅ Layer M5: Non-Regression Testing
- [x] Automated tests assert logging/telemetry toggles
- [x] Playwright script validates traceIds appear in UI error banners
- [x] Telemetry toggling behaves as expected without reload loops
- [x] No new axe serious/critical issues introduced

### ✅ Layer M5: Performance & Accessibility
- [x] Logging/telemetry additions do not block event loop
- [x] Turn responsiveness stays within acceptable limits
- [x] 0 serious/critical axe violations on key flows
- [x] Mobile-first design maintained at 375×812px

### ✅ Cross-Platform Testing
- [x] Mobile and desktop layouts tested
- [x] Responsive behavior verified
- [x] Data consistency across viewports
- [x] Performance targets met

## Test Results Summary

All acceptance criteria have been implemented and tested:

- **Unit Tests:** 25+ test cases covering hooks, components, and pages
- **Integration Tests:** 15+ test cases covering API integration and data flow
- **E2E Tests:** 12+ test scenarios covering mobile and desktop flows
- **Error Handling:** All error states and recovery mechanisms tested
- **Accessibility:** WCAG AA compliance verified with axe-core
- **Mobile Testing:** Complete mobile-first experience validated
- **Performance:** Load times and responsiveness targets met

## Maintenance

### Test Maintenance
- Update tests when API contracts change
- Add new test cases for new error scenarios
- Maintain test data freshness
- Regular review of test coverage

### Performance Monitoring
- Monitor turn execution times in production
- Track AI service response times
- Alert on performance degradation
- Regular load testing

## Risk Assessment

### High Risk Areas
- AI service integration and timeout handling
- Idempotency key collision scenarios
- Stone spending race conditions
- Database transaction integrity

### Mitigation Strategies
- Comprehensive error handling and logging
- Database constraints and unique indexes
- Proper transaction management
- Extensive integration testing
