# Stone Caster - Mock UI Implementation

This document explains how to run and interact with the mock UI implementation of Stone Caster.

## Overview

The mock UI provides a complete frontend experience using static mock data, allowing you to explore all the planned features and user flows without requiring backend integration. This implementation follows the UX design requirements and demonstrates the complete user journey from landing page to gameplay.

## Running the Mock UI

1. **Start the frontend development server:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open your browser to:** `http://localhost:5173`

## Available Routes & Features

### Primary Funnel (Invite-Gated)
- **`/`** - Landing page with hero section, carousel, differentiator highlights, and invite-only banner
- **`/adventures`** - Browse adventures with advanced filtering (search, tags, difficulty, stone cost range)
- **`/adventures/:id`** - Adventure detail page with world rules, differentiators, and "Begin Adventure" CTA
- **`/adventures/:id/characters`** - Character selection or creation using world-specific schemas
- **`/game/:gameId`** - Full gameplay interface with stone balance, turn input, history, and world rule meters

### World Exploration
- **`/worlds`** - Grid view of all worlds with filtering
- **`/worlds/:id`** - World detail page showing description, rules, differentiators, and related adventures

### Support & Account Pages
- **`/wallet`** - Stone balance, regeneration info, transaction history, and purchase options
- **`/payments`** - Subscription plans (Free/Premium) and stone pack purchases
- **`/profile`** - User profile, statistics, character management, and account settings
- **`/tos`** - Terms of Service
- **`/privacy`** - Privacy Policy  
- **`/ai-disclaimer`** - AI content disclaimer and usage information
- **`/faq`** - Frequently Asked Questions
- **`/about`** - About Stone Caster and team information

## Mock Data Structure

All data is loaded from static JSON files in `src/mock/`:

### Core Data Files
- **`worlds.json`** - Worlds with unique rules, differentiators, and metadata
- **`adventures.json`** - Adventures with tags, difficulty levels, stone costs, and world associations
- **`characters.json`** - Sample characters for each world with class information
- **`wallet.json`** - User's stone balance, regeneration rate, and transaction history
- **`limits.json`** - Account tier limits, current usage, and feature access
- **`invite.json`** - Invite status for feature gating

### World-Specific Schemas
- **`schemas/mystika.json`** - Character creation schema for the Mystika world
- **`schemas/aetherium.json`** - Character creation schema for the Aetherium world

## Key Features Demonstrated

### 🎯 Invite Gating System
- Landing page prominently displays invite-only status
- All "Start/Begin Adventure" CTAs show invite gating messages when `invited: false`
- Clear upgrade paths and invitation requirements
- Seamless experience when `invited: true`

### 👑 Account Tier Management
- **Free Tier**: Limited characters (3) and adventures (2)
- **Premium Tier**: Unlimited access with exclusive features
- Visual tier indicators and upgrade prompts throughout the UI
- Usage tracking and limit warnings

### 🧙‍♂️ Dynamic Character Creation
- World-specific character creation schemas
- Dynamic form fields that change based on selected world
- Shared steps (name, avatar, backstory) + world-specific fields
- Real-time validation and preview

### 🎮 Complete Game Interface
- Stone cost indicators with gem iconography
- Interactive world rule meters showing current state
- Turn input with "Cast Stone" branding and language
- Comprehensive history feed with timestamps
- Real-time balance updates

### 🔍 Advanced Filtering & Search
- Multi-criteria adventure filtering (world, difficulty, tags, stone cost)
- Real-time search across titles, descriptions, and tags
- Tag-based filtering with visual selection
- Stone cost range slider
- Clear filters functionality

### 🎨 Stone Branding & Visual Language
- Consistent gem iconography throughout
- "Cast Stone" language for all action buttons
- Subtle glow effects on cost indicators
- Stone-themed color palette and visual elements

## Testing Different States

### Toggle Invite Status (`src/mock/invite.json`)
```json
{
  "invited": false  // Test invite gating - all adventure starts disabled
}
```
```json
{
  "invited": true   // Full access - all features enabled
}
```

### Change Account Tier (`src/mock/limits.json`)
```json
{
  "tier": "free",           // Free tier limitations
  "maxCharacters": 3,
  "maxGames": 2
}
```
```json
{
  "tier": "premium",        // Premium unlimited access
  "maxCharacters": 999,
  "maxGames": 999
}
```

### Test Character Limits
- Set `currentCharacters` close to `maxCharacters` to see limit banners
- Try creating characters beyond the limit to see upgrade prompts

### First-Time User Experience
- Drifter guidance bubbles appear automatically and can be dismissed
- First-time flows show additional help and onboarding

## Component Architecture

### 🎴 Card Components
- **`WorldCard`** - World display with cover image, tags, and quick actions
- **`AdventureCard`** - Adventure display with difficulty, stone cost, and CTAs
- **`CardGrid`** - Responsive grid layout for cards

### 🎭 Overlay Components  
- **`AdventureModal`** - Modal overlay with adventure details and quick actions
- **`FilterPanel`** - Comprehensive filtering interface
- **`TierGate`** - Account tier upgrade prompts and comparisons

### 🎮 Gameplay Components
- **`CharacterCreator`** - Dynamic character creation with world schemas
- **`WorldFieldRenderer`** - Renders world-specific form fields
- **`StoneCost`** - Stone cost display with gem iconography
- **`WorldRuleMeters`** - Interactive progress bars for world rules
- **`TurnInput`** - Game turn input with "Cast Stone" branding
- **`HistoryFeed`** - Game history with timestamps and actions
- **`StoneLedgerWidget`** - Wallet display with transactions

### 🎯 Guidance Components
- **`DrifterBubble`** - Dismissible guidance bubbles for onboarding
- **`LimitBanner`** - Usage limit warnings and upgrade prompts

### 🎨 UI Components
- **`Avatar`** - User avatar display with fallbacks
- **`Alert`** - Notification and warning displays
- **`Checkbox`** - Form checkboxes with proper labeling
- **`Select`** - Dropdown selectors with search
- **`Slider`** - Range sliders for filtering

## Accessibility Features

### ♿ Keyboard Navigation
- Full keyboard navigation support
- Tab order follows logical flow
- Escape key closes modals
- Enter/Space activates buttons

### 🎯 Focus Management
- Focus traps in modals
- Visible focus indicators
- Skip navigation links
- Logical focus flow

### 🏷️ ARIA & Screen Reader Support
- Proper ARIA labels and descriptions
- Role attributes for custom components
- Live regions for dynamic content
- Semantic HTML structure

### 🎨 Visual Accessibility
- WCAG-AA color contrast compliance
- High contrast mode support
- Scalable text and icons
- Clear visual hierarchy

## Styling & Design System

### 📱 Mobile-First Design
- Optimized for 375×812 viewport (iPhone X/11/12)
- Responsive breakpoints for tablet and desktop
- Touch-friendly interface elements
- Mobile-optimized navigation

### 🌙 Dark Mode Support
- Automatic system preference detection
- Manual theme toggle
- Consistent dark/light mode theming
- Proper contrast in both modes

### 🎨 Design Tokens
- Consistent color palette
- Typography scale and hierarchy
- Spacing and layout system
- Component variants and states

## Testing the Complete Experience

### 1. **Non-Invited User Journey**
   - Set `invite.json` to `"invited": false`
   - Browse adventures and see disabled start buttons
   - Notice invite gating messages throughout
   - Test upgrade prompts and CTAs

### 2. **Invited User Journey**  
   - Set `invite.json` to `"invited": true`
   - Start adventures and create characters
   - Experience full gameplay interface
   - Test all interactive features

### 3. **Account Tier Testing**
   - Test free tier limitations
   - Upgrade to premium and see unlimited access
   - Test limit banners and upgrade prompts
   - Verify tier-specific features

### 4. **Character Creation Flow**
   - Navigate to character selection
   - Create characters for different worlds
   - See world-specific schemas in action
   - Test form validation and submission

### 5. **Gameplay Interface**
   - Start an adventure and enter game mode
   - Interact with world rule meters
   - Submit turns with stone costs
   - View history and balance updates

### 6. **Filtering & Search**
   - Test all filter combinations
   - Search across different criteria
   - Use stone cost range slider
   - Clear filters and reset state

## Integration Points

This mock implementation provides the foundation for:

### 🔌 Backend Integration
- API service layer ready for real endpoints
- Data models match expected backend structure
- Error handling patterns established
- Loading states and optimistic updates

### 🔐 Authentication System
- User state management structure
- Protected route patterns
- Session handling ready
- Role-based access control

### 💳 Payment Processing
- Subscription management UI
- Stone purchase flows
- Tier upgrade processes
- Transaction history display

### 🤖 AI Content Generation
- Dynamic content loading patterns
- Real-time updates ready
- Content caching strategies
- Fallback content handling

### 🎮 Real-Time Game State
- Game state management structure
- Turn submission patterns
- History and logging systems
- Multiplayer readiness

## Development Notes

### 🏗️ Architecture Decisions
- **Component Composition**: Reusable, composable components
- **State Management**: Local state with React hooks, ready for global state
- **Data Flow**: Unidirectional data flow with clear separation
- **Type Safety**: Full TypeScript coverage with shared interfaces

### 🧪 Testing Strategy
- **Unit Tests**: Component testing with React Testing Library
- **Integration Tests**: User flow testing with Playwright
- **Accessibility Tests**: Automated a11y testing with axe-core
- **Visual Tests**: Screenshot testing for UI consistency

### 📦 Build & Deployment
- **Vite**: Fast development and optimized production builds
- **Tailwind CSS**: Utility-first styling with design system
- **shadcn/ui**: Accessible component library
- **Cloudflare Workers**: Ready for edge deployment

## Next Steps

1. **Backend Integration**: Connect to real APIs and services
2. **Authentication**: Implement user registration and login
3. **Payment Processing**: Integrate Stripe for subscriptions and purchases
4. **AI Integration**: Connect to AI services for dynamic content
5. **Real-Time Features**: Add WebSocket connections for live updates
6. **Performance Optimization**: Implement caching and lazy loading
7. **Analytics**: Add user behavior tracking and metrics
8. **Testing**: Comprehensive test suite with CI/CD integration

The mock UI provides a solid foundation for all these integrations while maintaining the established UX patterns and design system.