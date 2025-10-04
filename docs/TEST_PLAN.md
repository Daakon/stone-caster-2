# Stone Caster Test Plan - Layer M5

## Overview

This document outlines the comprehensive test plan for Layer M5 - Hardening & QA Readiness, focusing on observability, telemetry, error handling, and tester enablement. Layer M5 builds upon Layer M4's unified play UI with enhanced diagnostics and self-serve QA capabilities.

## Test Objectives

- Verify structured logging with traceIds and meaningful context
- Test configurable telemetry system for gameplay events
- Validate enhanced error handling with actionable messages and traceIds
- Ensure self-serve QA capabilities with clear runbooks
- Test telemetry toggles and configuration endpoints
- Verify traceId capture and error reporting workflows
- Confirm accessibility compliance (0 serious/critical axe violations)
- Test mobile navigation with hamburger menu and drawer
- Validate responsive layout transitions between breakpoints

## Unit Tests

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
