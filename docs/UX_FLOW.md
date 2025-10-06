# Stone Caster UX Flow - Layer M6

## Overview

This document describes the user experience flow for Stone Caster's Layer M6 implementation, focusing on secure profile management, guest-to-auth upgrades, and session safety. Layer M6 builds upon Layer M5's observability features with comprehensive user account management and security controls.

## Core User Flows

### 1. Profile Management Flow (Layer M6)

#### Guest User Profile Access
1. **Navigation**: Guest user navigates to `/profile`
2. **Access Control**: System detects guest status and shows authentication required message
3. **User Guidance**: Clear messaging explains benefits of signing in
4. **Action Options**: 
   - "Sign In" button redirects to authentication
   - "Back to Home" returns to main page
5. **Mobile Experience**: Responsive design works seamlessly at 375Ã—812px

#### Authenticated User Profile Management
1. **Profile Access**: Authenticated user navigates to `/profile`
2. **Data Loading**: Profile information loads with user's current settings
3. **Profile Viewing**: 
   - Display name, email, and avatar
   - Account status and membership information
   - Preferences and notification settings
   - Session management options
4. **Profile Editing**:
   - Click "Edit" to enter edit mode
   - Modify display name, avatar URL, and preferences
   - Inline validation prevents invalid inputs
   - "Save" commits changes with CSRF protection
   - "Cancel" reverts to original values
5. **Session Management**:
   - View current session information
   - "Revoke Other Sessions" with confirmation
   - CSRF token validation for security
   - Clear feedback on session revocation results

#### Guest to Auth Upgrade Flow
1. **Guest State**: User has active games/characters as guest
2. **Authentication**: User signs in with valid credentials
3. **Automatic Linking**: System automatically links guest data to authenticated account
4. **Data Preservation**: All guest progress (games, characters, stones) is preserved
5. **Idempotent Operation**: Repeating the process doesn't create duplicates
6. **User Feedback**: Clear confirmation that account has been linked
7. **Cookie Cleanup**: Guest cookie is cleared after successful linking

### 2. Authentication Flow (Fixed)

#### Sign-In Page Access
1. **Landing Page**: User clicks "Sign In" button
2. **Navigation**: System navigates to `/auth/signin`
3. **Page Rendering**: Sign-in page renders without redirecting back to landing page
4. **Guest Support**: Guests can stay on auth pages without being bounced back
5. **Form Interaction**: User can interact with sign-in form normally

#### OAuth Flow (Google/GitHub/Discord)
1. **OAuth Initiation**: User clicks "Sign in with Google" (or other provider)
2. **Provider Redirect**: System redirects to OAuth provider consent screen
3. **Callback Handling**: System detects OAuth callback parameters (both URL search and hash fragments)
4. **Session Creation**: Supabase session is created from OAuth tokens
5. **State Update**: AuthService updates user state and notifies listeners
6. **Route Redirect**: AuthRouter detects authenticated state and redirects to intended route
7. **URL Cleanup**: OAuth parameters are removed from URL for clean navigation

#### Guest Authentication
1. **Guest Access**: Guests can access wallet balance and other read-only features
2. **Cookie Management**: Guest cookies are properly managed and sent with API requests
3. **API Access**: Guest users can make read-only API calls without 401 errors
4. **Session Persistence**: Guest sessions persist across page refreshes

#### Play Route Navigation
1. **Character Access**: Users can navigate to `/play/:characterId` routes
2. **Game Loading**: System loads character data and associated game
3. **Error Handling**: Proper error messages for characters without active games
4. **No 404 Errors**: Route resolves correctly without showing "Page Not Found"

### 3. Game Play Flow (Mobile-First)

#### Mobile Experience (375Ã—812px)
- **Header**: Compact header with logo, stone balance, and hamburger menu
- **Navigation**: Slide-out drawer with navigation items and stone balance
- **Main Content**: Story history, turn input, and game state in stacked layout
- **Sidebar**: Character info, world rules, and stone balance in collapsible sections

#### Desktop Experience (â‰¥1024px)
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

#### Error Handling (Layer M6 Enhanced)
- **Insufficient Stones**: Clear error message with "Go to Wallet" CTA and traceId
- **Timeout**: Retry guidance with server status information and traceId
- **Validation**: Action-specific error messages with suggestions and traceId
- **Network**: Connection error with retry options and traceId
- **Idempotency**: Duplicate action prevention with wait guidance and traceId
- **Profile Access**: Clear messaging when guests try to access profile features
- **CSRF Errors**: Clear guidance when CSRF tokens are invalid or expired
- **Session Errors**: Helpful messages for session revocation failures
- **Linking Errors**: Clear feedback when guest account linking fails
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
- **Navigation Items**: Home, Worlds, My Adventures, Wallet, Profile

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

## Layer M6: Profile & Session Management

### Profile Management Flow
1. **Access Control**: System checks user authentication status
2. **Guest Handling**: Guests see authentication required message with sign-in prompt
3. **Profile Loading**: Authenticated users see their profile data and settings
4. **Profile Editing**: Users can modify display name, avatar, and preferences
5. **Session Management**: Users can revoke other sessions with CSRF protection
6. **Data Persistence**: All changes are saved with proper validation and security

### Guest Account Linking Flow
1. **Guest State**: User has active games/characters as guest
2. **Authentication**: User signs in with valid credentials
3. **Automatic Detection**: System detects guest cookie and initiates linking
4. **Data Migration**: Guest data is linked to authenticated account
5. **Idempotency**: Repeating the process doesn't create duplicates
6. **User Feedback**: Clear confirmation that account has been linked
7. **Cleanup**: Guest cookie is cleared after successful linking

### Session Safety Flow
1. **CSRF Token**: System generates CSRF token for profile operations
2. **Token Validation**: All profile updates require valid CSRF token
3. **Session Revocation**: Users can revoke other sessions with confirmation
4. **Security Logging**: All security operations are logged with traceId
5. **Error Handling**: Clear feedback for security-related errors

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

### Mobile Testing (375Ã—812)
- **Navigation**: Hamburger menu and drawer functionality
- **Turn Loop**: Complete turn submission and response
- **Error Handling**: All error states with recovery actions
- **Accessibility**: Touch targets and screen reader support

### Desktop Testing (â‰¥1024px)
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

