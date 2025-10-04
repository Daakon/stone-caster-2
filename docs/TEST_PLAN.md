# Stone Caster Test Plan - Layer M4

## Overview

This document outlines the comprehensive test plan for Layer M4 - Unified Play UI implementation, covering unit tests, integration tests, and end-to-end tests with mobile-first design and live data integration.

## Test Objectives

- Verify unified play surface with live data integration
- Ensure mobile-first design works across all viewport sizes
- Validate turn execution with real API responses
- Test comprehensive error handling and recovery mechanisms
- Confirm accessibility compliance (0 serious/critical axe violations)
- Verify telemetry tracking without duplicate events
- Test mobile navigation with hamburger menu and drawer
- Validate responsive layout transitions between breakpoints

## Unit Tests

### Game Telemetry Hook Tests
- **File:** `frontend/src/hooks/useGameTelemetry.test.ts`
- **Coverage:**
  - `trackTurnStarted()` - event tracking with metadata
  - `trackTurnCompleted()` - success tracking with duration
  - `trackTurnFailed()` - error tracking with error codes
  - `trackGameLoaded()` - load time tracking
  - `trackErrorShown()` - error display tracking
  - `trackRetryAttempted()` - retry action tracking
  - Deduplication - prevent duplicate events within 1 second
  - Error handling - graceful API failure handling
  - Cleanup - old events removed after 5 minutes

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

### Database Integration Tests
- **Coverage:**
  - Turn record creation in `turns` table
  - Idempotency record storage in `idempotency_keys` table
  - Stone wallet updates and ledger entries
  - Game state updates

## End-to-End Tests

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

### ✅ Live Data Integration
- [x] All game data loaded from real APIs (no mock data)
- [x] Game, character, world, and wallet data from live endpoints
- [x] Real-time updates after turn submission
- [x] Proper error handling for API failures

### ✅ Mobile-First Design
- [x] Responsive layout works at 375×812px
- [x] Hamburger menu and drawer navigation
- [x] Touch-friendly interface elements
- [x] Proper breakpoint transitions

### ✅ Unified Play Surface
- [x] Story history with real-time updates
- [x] Turn input with stone cost indicators
- [x] Stone balance and world rule meters
- [x] Character information display

### ✅ Error Handling & Recovery
- [x] Comprehensive error states for all failure scenarios
- [x] Retry mechanisms with user guidance
- [x] Wallet navigation for insufficient stones
- [x] Help system integration

### ✅ Accessibility Compliance
- [x] 0 serious/critical axe violations
- [x] Keyboard navigation support
- [x] Screen reader compatibility
- [x] Proper ARIA labels and semantic HTML

### ✅ Telemetry & Analytics
- [x] Event tracking without duplicates
- [x] Proper deduplication mechanisms
- [x] Error tracking and retry analytics
- [x] Performance metrics collection

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
