# Stone Caster UX Flow - Layer M5

## Overview

This document describes the user experience flow for Stone Caster's Layer M5 implementation, focusing on hardening, observability, and QA readiness. Layer M5 builds upon Layer M4's unified play surface with enhanced diagnostics, telemetry, and self-serve testing capabilities.

## Core User Flows

### 1. Game Play Flow (Mobile-First)

#### Mobile Experience (375×812px)
- **Header**: Compact header with logo, stone balance, and hamburger menu
- **Navigation**: Slide-out drawer with navigation items and stone balance
- **Main Content**: Story history, turn input, and game state in stacked layout
- **Sidebar**: Character info, world rules, and stone balance in collapsible sections

#### Desktop Experience (≥1024px)
- **Header**: Full header with navigation items and stone balance
- **Layout**: Three-column grid with main content (2/3) and sidebar (1/3)
- **Sidebar**: Persistent sidebar with character, world rules, and stone balance
- **Navigation**: Horizontal navigation bar with all menu items

### 2. Turn Loop Experience

#### Turn Submission
1. **Input**: Player types action in textarea with stone cost indicator
2. **Validation**: Real-time validation of input length and format
3. **Submission**: Button shows "Processing..." state with spinner
4. **History**: Player action immediately added to history feed
5. **Response**: AI response added to history with narrative and choices
6. **State Update**: Stone balance, turn count, and world rules updated

#### Error Handling (Layer M5 Enhanced)
- **Insufficient Stones**: Clear error message with "Go to Wallet" CTA and traceId
- **Timeout**: Retry guidance with server status information and traceId
- **Validation**: Action-specific error messages with suggestions and traceId
- **Network**: Connection error with retry options and traceId
- **Idempotency**: Duplicate action prevention with wait guidance and traceId
- **TraceId Display**: All errors show copyable traceId for support reporting
- **Actionable CTAs**: Error banners include specific action buttons (Go to Wallet, Get Help, Try Again)

### 3. Data Flow (Live APIs)

#### Game Loading
1. **Game Data**: `/api/games/:id` - Game state, turn count, adventure info
2. **Character Data**: `/api/characters/:id` - Character details and world data
3. **World Data**: `/api/content/worlds` - World rules and display settings
4. **Wallet Data**: `/api/stones/wallet` - Stone balance and currency info

#### Turn Processing
1. **Submission**: `/api/games/:id/turn` with idempotency key
2. **Response**: Turn DTO with narrative, choices, and state updates
3. **Cache Invalidation**: React Query refetches game and wallet data
4. **State Update**: Local state updated with new turn data

### 4. Mobile Navigation Flow

#### Authenticated Routes
- **Hamburger Menu**: Slide-out drawer with navigation items
- **Stone Balance**: Displayed in header and drawer
- **User Info**: Email and sign-out option in drawer
- **Navigation Items**: Home, Worlds, My Games, Wallet, Profile

#### Desktop Navigation
- **Persistent Sidebar**: Always visible navigation with user info
- **Stone Balance**: Prominently displayed in sidebar
- **Quick Access**: Direct links to all major sections

## Error States & Recovery

### Turn Errors
- **Insufficient Stones**: Clear messaging with wallet link
- **Timeout**: Retry guidance with server status
- **Validation**: Action-specific suggestions
- **Network**: Connection troubleshooting
- **Idempotency**: Duplicate prevention messaging

### Loading States
- **Skeleton Loading**: For initial game data load
- **Spinner States**: For turn submission and API calls
- **Progressive Loading**: Character, world, and wallet data load independently

### Empty States
- **No History**: Welcome message for new games
- **No Characters**: Character creation guidance
- **No Games**: Adventure selection guidance

## Accessibility Features

### Keyboard Navigation
- **Tab Order**: Logical focus flow through interface
- **Skip Links**: Jump to main content, navigation, footer
- **Form Labels**: All inputs properly labeled
- **Button States**: Clear disabled and loading states

### Screen Reader Support
- **ARIA Labels**: All interactive elements labeled
- **Live Regions**: Turn results announced
- **Semantic HTML**: Proper heading structure and landmarks
- **Focus Management**: Focus returns to appropriate elements

### Visual Accessibility
- **Color Contrast**: WCAG AA compliant colors
- **Touch Targets**: Minimum 44px touch targets on mobile
- **Text Size**: Readable font sizes with scaling support
- **Motion**: Respects prefers-reduced-motion

## Layer M5: Observability & Telemetry

### Structured Logging Flow
1. **Request Initiation**: Every API request gets unique traceId
2. **Context Capture**: Logs include route, method, user context, latency
3. **Error Logging**: Errors logged with traceId, error code, and context
4. **Response Headers**: traceId included in response headers for debugging
5. **Log Aggregation**: Structured JSON logs for easy parsing and analysis

### Telemetry Event Flow
1. **Event Initiation**: Frontend triggers gameplay events (turn_started, turn_completed, etc.)
2. **Configuration Check**: Telemetry service checks if telemetry is enabled and applies sampling
3. **Event Queuing**: Events queued for batch processing to avoid blocking UI
4. **API Submission**: Events sent to `/api/telemetry/gameplay` endpoint
5. **Database Storage**: Events stored in `telemetry_events` table with user context
6. **Error Handling**: Failed telemetry doesn't break user flow

### QA Testing Flow
1. **Configuration Check**: QA can check `/api/telemetry/config` for current settings
2. **Event Verification**: QA can verify events are being recorded during testing
3. **Error Reporting**: QA can copy traceIds from error banners for bug reports
4. **Log Correlation**: QA can correlate frontend errors with backend logs using traceIds
5. **Telemetry Toggle**: QA can enable/disable telemetry without code deployment

### Error Reporting Flow
1. **Error Occurrence**: User encounters error during gameplay
2. **Error Display**: Error banner shows with actionable message and traceId
3. **TraceId Copy**: User can copy traceId for support reporting
4. **Support Ticket**: User includes traceId in bug report or support ticket
5. **Log Lookup**: Support team uses traceId to find relevant logs and telemetry
6. **Issue Resolution**: Support team can trace full request flow for debugging

## Performance Considerations

### Mobile Optimization
- **Touch Targets**: 44px minimum for all interactive elements
- **Scroll Performance**: Smooth scrolling with proper touch handling
- **Image Optimization**: Responsive images with proper sizing
- **Bundle Size**: Code splitting for mobile performance

### Desktop Optimization
- **Grid Layout**: Efficient CSS Grid for responsive design
- **Sidebar**: Persistent sidebar with smooth transitions
- **Keyboard Shortcuts**: Power user keyboard navigation
- **Window Management**: Proper window resize handling

## Testing Scenarios

### Mobile Testing (375×812)
- **Navigation**: Hamburger menu and drawer functionality
- **Turn Loop**: Complete turn submission and response
- **Error Handling**: All error states with recovery actions
- **Accessibility**: Touch targets and screen reader support

### Desktop Testing (≥1024px)
- **Layout**: Three-column grid with proper proportions
- **Sidebar**: Persistent navigation and state display
- **Keyboard**: Full keyboard navigation support
- **Performance**: Smooth interactions and transitions

### Cross-Platform
- **Responsive**: Smooth transitions between breakpoints
- **Data Consistency**: Same data across all viewports
- **Error States**: Consistent error handling across platforms
- **Accessibility**: WCAG compliance on all devices

## Future Enhancements

### Planned Features
- **Real-time Updates**: WebSocket integration for live game state
- **Offline Support**: Service worker for offline gameplay
- **Push Notifications**: Turn notifications and game updates
- **Advanced Analytics**: Detailed user behavior tracking

### Accessibility Improvements
- **Voice Control**: Voice input for turn actions
- **High Contrast**: Enhanced contrast mode
- **Font Scaling**: Dynamic font size adjustment
- **Gesture Support**: Custom gesture recognition

## Success Metrics

### User Experience
- **Time to First Turn**: < 30 seconds from game load
- **Error Recovery**: > 80% successful error recovery
- **Mobile Usage**: > 60% of sessions on mobile devices
- **Accessibility**: 0 serious/critical axe violations

### Technical Performance
- **Load Time**: < 3 seconds for game page load
- **Turn Response**: < 5 seconds for turn processing
- **Error Rate**: < 5% turn submission failures
- **Cache Hit Rate**: > 80% for repeated data requests
