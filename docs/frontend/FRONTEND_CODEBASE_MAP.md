# Frontend Codebase Cartography

**Last Updated:** 2025-01-XX  
**Purpose:** Factual map of existing frontend codebase structure, routes, components, and services.

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Routing](#routing)
3. [Pages](#pages)
4. [Features](#features)
5. [Components](#components)
6. [Services](#services)
7. [Hooks](#hooks)
8. [Stores](#stores)
9. [Types](#types)
10. [UI Components](#ui-components)
11. [Configuration](#configuration)

---

## Directory Structure

```
frontend/src/
├── admin/                    # Admin route guard and routing
├── api/                      # API client (chimera-client.ts)
├── assets/                   # Static assets
├── components/               # Shared React components
│   ├── admin/               # Admin-specific components
│   ├── auth/                # Authentication components
│   ├── cards/               # Card components
│   ├── catalog/             # Catalog display components
│   ├── character/           # Character-related components
│   ├── chimera/             # Chimera domain components
│   ├── common/              # Common reusable components
│   ├── debug/               # Debug utilities
│   ├── earlyAccess/         # Early access UI
│   ├── editors/             # Form editors
│   ├── error/               # Error handling components
│   ├── filters/             # Filter components
│   ├── form/                # Form components
│   ├── game/                # Game UI components
│   ├── gameplay/            # Gameplay-specific components
│   ├── guidance/            # Guidance/help components
│   ├── layout/              # Layout components
│   ├── play/                # Play-specific components
│   ├── publishing/          # Publishing components
│   ├── redirects/           # Redirect components
│   └── ui/                  # shadcn/ui components
├── config/                   # Feature flags and config
├── contexts/                 # React contexts (theme)
├── data/                     # Static data (rulesets, presets)
├── engine/                   # Game engine utilities
├── features/                 # Feature modules
│   ├── active-game/         # Active game services
│   ├── casting-circle/      # Casting circle wizard
│   ├── create-story/        # Story creation wizard
│   ├── dashboard/           # Dashboard feature
│   ├── engine/              # Engine components
│   ├── game-v3/             # Game V3 wizard
│   ├── play/                # Play feature components
│   └── rulesets/            # Ruleset management
├── hooks/                    # Custom React hooks
├── lib/                      # Utility libraries
├── mock/                     # Mock data (JSON)
├── pages/                    # Page components
│   ├── admin/               # Admin pages
│   ├── casting-circle/      # Casting circle page
│   ├── dashboard/           # Dashboard pages
│   ├── npcs/                # NPC pages
│   ├── play/                # Play pages
│   ├── publishing/          # Publishing pages
│   ├── rulesets/            # Ruleset pages
│   ├── settings/            # Settings pages
│   ├── stories/             # Story pages
│   └── worlds/              # World pages
├── providers/                # Context providers
├── services/                 # API service layer
├── store/                    # Legacy store (auth, game, studio)
├── stores/                   # Zustand stores
├── test/                     # Test setup
├── tests/                    # Test files
├── types/                    # TypeScript type definitions
├── ui/                       # UI utilities
├── utils/                    # Utility functions
├── worker/                   # Cloudflare Worker code
├── App.tsx                   # Root app component
└── main.tsx                  # Entry point
```

---

## Routing

### Router Configuration
- **File:** `frontend/src/App.tsx`
- **Router:** React Router v6 (`react-router-dom`)
- **Future Flags:** `v7_startTransition: true`, `v7_relativeSplatPath: true`

### Route Guards
- **ProtectedRoute:** `frontend/src/components/auth/ProtectedRoute.tsx` - Requires authentication
- **EarlyAccessRoute:** `frontend/src/components/auth/EarlyAccessRoute.tsx` - Requires early access approval
- **AdminRouteGuard:** `frontend/src/admin/AdminRouteGuard.tsx` - Requires admin role

### Route Categories

#### Public Routes (No Auth Required)
| Path | Component | File |
|------|-----------|------|
| `/` | LandingPage | `frontend/src/pages/LandingPage.tsx` |
| `/auth` | AuthPage | `frontend/src/pages/AuthPage.tsx` |
| `/auth/signin` | AuthPage (mode="signin") | `frontend/src/pages/AuthPage.tsx` |
| `/auth/signup` | AuthPage (mode="signup") | `frontend/src/pages/AuthPage.tsx` |
| `/auth/success` | AuthSuccessPage | `frontend/src/pages/AuthSuccessPage.tsx` |
| `/request-access` | RequestAccessPage | `frontend/src/pages/RequestAccessPage.tsx` |
| `/support` | SupportPage | `frontend/src/pages/SupportPage.tsx` |
| `/_test_gallery` | TestGalleryPage | `frontend/src/pages/_test_gallery.tsx` |

#### Protected Routes (Auth + Early Access)
| Path | Component | File |
|------|-----------|------|
| `/stories` | StoriesPage | `frontend/src/pages/stories/StoriesPage.tsx` |
| `/stories/compose` | CreateStoryPage | `frontend/src/features/create-story/components/CreateStoryPage.tsx` |
| `/stories/:id/compose` | CastingCircleWizard | `frontend/src/features/casting-circle/CastingCircleWizard.tsx` |
| `/stories/:id/compose/:step` | CastingCircleWizard | `frontend/src/features/casting-circle/CastingCircleWizard.tsx` |
| `/stories/:id` | StoryDetailPage | `frontend/src/pages/stories/StoryDetailPage.tsx` |
| `/play/start/:storyId` | StartStoryPage | `frontend/src/features/play/start/StartStoryPage.tsx` |
| `/play/:gameStateId` | GamePage | `frontend/src/pages/play/GamePage.tsx` |
| `/play/create/:storyId` | CharacterCreatorPageV2 | `frontend/src/pages/play/create/CharacterCreatorPage.tsx` |
| `/story/:id/new` | NewGameWizard | `frontend/src/features/game-v3/NewGameWizard.tsx` |
| `/create-character/:storyId` | CharacterCreationPage | `frontend/src/pages/play/CharacterCreationPage.tsx` |
| `/player-gateway/:storyId` | PlayerGatewayPage | `frontend/src/pages/play/PlayerGatewayPage.tsx` |
| `/worlds` | WorldsPage | `frontend/src/pages/worlds/WorldsPage.tsx` |
| `/worlds/:slug` | WorldDetailPage | `frontend/src/pages/worlds/WorldDetailPage.tsx` |
| `/npcs` | NPCsPage | `frontend/src/pages/npcs/NPCsPage.tsx` |
| `/npcs/:id` | NPCDetailPage | `frontend/src/pages/npcs/NPCDetailPage.tsx` |
| `/rulesets` | RulesetsPage | `frontend/src/pages/rulesets/RulesetsPage.tsx` |
| `/rulesets/:id` | RulesetDetailPage | `frontend/src/pages/rulesets/RulesetDetailPage.tsx` |
| `/profile` | ProfilePage | `frontend/src/pages/ProfilePage.tsx` |
| `/my-creations` | MyCreationsPage | `frontend/src/features/dashboard/MyCreationsPage.tsx` |
| `/create-story` | CreateStoryPage | `frontend/src/features/create-story/components/CreateStoryPage.tsx` |

#### Dashboard Routes (Auth + Early Access)
| Path | Component | File |
|------|-----------|------|
| `/dashboard/worlds/new` | WorldEditor | `frontend/src/pages/dashboard/worlds/Editor.tsx` |
| `/dashboard/worlds/edit/:id` | WorldEditor | `frontend/src/pages/dashboard/worlds/Editor.tsx` |
| `/dashboard/worlds/:id/manage` | WorldManage | `frontend/src/pages/dashboard/worlds/Manage.tsx` |
| `/dashboard/entities/new` | EntityEditor | `frontend/src/pages/dashboard/entities/Editor.tsx` |
| `/dashboard/entities/edit/:id` | EntityEditor | `frontend/src/pages/dashboard/entities/Editor.tsx` |
| `/dashboard/entities/:id/manage` | EntityManage | `frontend/src/pages/dashboard/entities/Manage.tsx` |
| `/dashboard/stories/:id/studio` | StoryStudio | `frontend/src/pages/dashboard/stories/Studio.tsx` |
| `/dashboard/stories/:id/manage` | StoryManage | `frontend/src/pages/dashboard/stories/Manage.tsx` |
| `/dashboard/packs/new` | PackEditor | `frontend/src/pages/dashboard/packs/Editor.tsx` |
| `/dashboard/packs/edit/:id` | PackEditor | `frontend/src/pages/dashboard/packs/Editor.tsx` |
| `/dashboard/packs/:id/manage` | PackManage | `frontend/src/pages/dashboard/packs/Manage.tsx` |
| `/dashboard/lore/new` | LoreEditor | `frontend/src/pages/dashboard/lore/Editor.tsx` |
| `/dashboard/lore/edit/:id` | LoreEditor | `frontend/src/pages/dashboard/lore/Editor.tsx` |
| `/dashboard/lore/:id/manage` | LoreManage | `frontend/src/pages/dashboard/lore/Manage.tsx` |
| `/settings/profile` | CreatorProfileSettings | `frontend/src/pages/settings/CreatorProfile.tsx` |

#### Admin Routes (Admin Role Required)
- **Base Path:** `/admin/*`
- **Guard:** `AdminRouteGuard` (`frontend/src/admin/AdminRouteGuard.tsx`)
- **Routes:** Defined in `frontend/src/admin/AdminRoutes.tsx`

| Path | Component | File | Guard Level |
|------|-----------|------|-------------|
| `/admin` | AdminHome | `frontend/src/pages/admin/index.tsx` | Public (authenticated) |
| `/admin/roles` | RolesAdmin | `frontend/src/pages/admin/roles/index.tsx` | Admin |
| `/admin/access-requests` | AccessRequestsAdmin | `frontend/src/pages/admin/access-requests/index.tsx` | Admin |
| `/admin/templates` | TemplatesManager | `frontend/src/pages/admin/TemplatesManager.tsx` | Creator/Moderator/Admin |
| `/admin/publishing/wizard` | PublishingWizard | `frontend/src/pages/publishing/wizard.tsx` | Creator/Moderator/Admin |
| `/admin/publishing-wizard/:entityType/:entityId` | PublishingWizardPage | `frontend/src/pages/admin/publishing-wizard/[entityType]/[entityId].tsx` | Moderator/Admin |
| `/admin/media/approvals` | ApprovalsPage | `frontend/src/pages/admin/media/ApprovalsPage.tsx` | Admin |
| `/admin/chimera/dashboard` | ChimeraDashboard | `frontend/src/pages/admin/chimera/Dashboard.tsx` | Moderator/Admin |
| `/admin/chimera/rulesets` | RulesetTemplatesDashboard | `frontend/src/pages/admin/chimera/rulesets/index.tsx` | Moderator/Admin |
| `/admin/chimera/rulesets/new` | RulesetTemplateEditor | `frontend/src/pages/admin/chimera/rulesets/Editor.tsx` | Moderator/Admin |
| `/admin/chimera/rulesets/edit/:id` | RulesetTemplateEditor | `frontend/src/pages/admin/chimera/rulesets/Editor.tsx` | Moderator/Admin |
| `/admin/chimera/worlds` | ChimeraWorldsAdmin | `frontend/src/pages/admin/chimera/worlds/index.tsx` | Moderator/Admin |
| `/admin/chimera/worlds/list` | WorldListPage | `frontend/src/pages/admin/chimera/worlds/WorldListPage.tsx` | Admin |
| `/admin/chimera/worlds/new` | WorldEditorPage | `frontend/src/pages/admin/chimera/worlds/WorldEditorPage.tsx` | Admin |
| `/admin/chimera/worlds/edit/:id` | WorldEditorPage | `frontend/src/pages/admin/chimera/worlds/WorldEditorPage.tsx` | Admin |
| `/admin/chimera/entities` | ChimeraEntitiesAdmin | `frontend/src/pages/admin/chimera/entities/index.tsx` | Moderator/Admin |
| `/admin/chimera/entities/list` | EntityListPage | `frontend/src/pages/admin/chimera/entities/EntityListPage.tsx` | Admin |
| `/admin/chimera/entities/new` | EntityEditorPage | `frontend/src/pages/admin/chimera/entities/EntityEditorPage.tsx` | Admin |
| `/admin/chimera/entities/edit/:id` | EntityEditorPage | `frontend/src/pages/admin/chimera/entities/EntityEditorPage.tsx` | Admin |
| `/admin/chimera/tags` | TagManagement | `frontend/src/pages/admin/chimera/tags/index.tsx` | Moderator/Admin |

#### Legacy Redirects
| Path | Redirects To |
|------|--------------|
| `/dashboard/creations` | `/my-creations` |
| `/dashboard/creations/:tab` | `/my-creations?tab=:tab` |
| `/dashboard/stories/new` | 404 (NotFoundPage) |
| `/dashboard/stories/edit/:id` | 404 (NotFoundPage) |

---

## Pages

### Public Pages
| Page | File | Description |
|------|------|-------------|
| LandingPage | `frontend/src/pages/LandingPage.tsx` | Landing/marketing page |
| AuthPage | `frontend/src/pages/AuthPage.tsx` | Authentication (signin/signup) |
| AuthSuccessPage | `frontend/src/pages/AuthSuccessPage.tsx` | OAuth callback handler |
| RequestAccessPage | `frontend/src/pages/RequestAccessPage.tsx` | Early access request form |
| SupportPage | `frontend/src/pages/SupportPage.tsx` | Support/FAQ page |
| NotFoundPage | `frontend/src/pages/NotFoundPage.tsx` | 404 page |
| TestGalleryPage | `frontend/src/pages/_test_gallery.tsx` | Test component gallery |

### Catalog Pages
| Page | File | Description |
|------|------|-------------|
| StoriesPage | `frontend/src/pages/stories/StoriesPage.tsx` | Story catalog listing |
| StoryDetailPage | `frontend/src/pages/stories/StoryDetailPage.tsx` | Story detail view |
| WorldsPage | `frontend/src/pages/worlds/WorldsPage.tsx` | World catalog listing |
| WorldDetailPage | `frontend/src/pages/worlds/WorldDetailPage.tsx` | World detail view |
| NPCsPage | `frontend/src/pages/npcs/NPCsPage.tsx` | NPC catalog listing |
| NPCDetailPage | `frontend/src/pages/npcs/NPCDetailPage.tsx` | NPC detail view |
| RulesetsPage | `frontend/src/pages/rulesets/RulesetsPage.tsx` | Ruleset catalog listing |
| RulesetDetailPage | `frontend/src/pages/rulesets/RulesetDetailPage.tsx` | Ruleset detail view |

### Play Pages
| Page | File | Description |
|------|------|-------------|
| StartStoryPage | `frontend/src/features/play/start/StartStoryPage.tsx` | Story start/character selection |
| StartGatewayPage | `frontend/src/features/play/start/StartGatewayPage.tsx` | Story gateway/entry point |
| CharacterCreationPage | `frontend/src/pages/play/CharacterCreationPage.tsx` | Legacy character creation |
| CharacterCreatorPage | `frontend/src/pages/play/create/CharacterCreatorPage.tsx` | V2 character creation wizard |
| PlayerGatewayPage | `frontend/src/pages/play/PlayerGatewayPage.tsx` | Player entry gateway |
| GamePage | `frontend/src/pages/play/GamePage.tsx` | Main game interface |
| GameStatePage | `frontend/src/pages/play/GameStatePage.tsx` | Game state view (UNKNOWN: usage) |

### Creation Pages
| Page | File | Description |
|------|------|-------------|
| CreateStoryPage | `frontend/src/features/create-story/components/CreateStoryPage.tsx` | Story creation wizard |
| CastingCircleWizard | `frontend/src/features/casting-circle/CastingCircleWizard.tsx` | Casting circle story editor |
| NewGameWizard | `frontend/src/features/game-v3/NewGameWizard.tsx` | New game wizard |
| MyCreationsPage | `frontend/src/features/dashboard/MyCreationsPage.tsx` | User creations dashboard |

### Dashboard Pages
| Page | File | Description |
|------|------|-------------|
| WorldEditor | `frontend/src/pages/dashboard/worlds/Editor.tsx` | World editor |
| WorldManage | `frontend/src/pages/dashboard/worlds/Manage.tsx` | World management |
| EntityEditor | `frontend/src/pages/dashboard/entities/Editor.tsx` | Entity editor |
| EntityManage | `frontend/src/pages/dashboard/entities/Manage.tsx` | Entity management |
| StoryStudio | `frontend/src/pages/dashboard/stories/Studio.tsx` | Story studio |
| StoryManage | `frontend/src/pages/dashboard/stories/Manage.tsx` | Story management |
| PackEditor | `frontend/src/pages/dashboard/packs/Editor.tsx` | Pack editor |
| PackManage | `frontend/src/pages/dashboard/packs/Manage.tsx` | Pack management |
| LoreEditor | `frontend/src/pages/dashboard/lore/Editor.tsx` | Lore editor |
| LoreManage | `frontend/src/pages/dashboard/lore/Manage.tsx` | Lore management |

### Settings Pages
| Page | File | Description |
|------|------|-------------|
| ProfilePage | `frontend/src/pages/ProfilePage.tsx` | User profile |
| CreatorProfileSettings | `frontend/src/pages/settings/CreatorProfile.tsx` | Creator profile settings |

### Admin Pages
See [Admin Routes](#admin-routes-admin-role-required) section above.

---

## Features

### Feature Modules
Features are organized in `frontend/src/features/`:

| Feature | Directory | Description |
|---------|-----------|-------------|
| active-game | `frontend/src/features/active-game/` | Active game services |
| casting-circle | `frontend/src/features/casting-circle/` | Casting circle wizard |
| create-story | `frontend/src/features/create-story/` | Story creation wizard |
| dashboard | `frontend/src/features/dashboard/` | Dashboard components |
| engine | `frontend/src/features/engine/` | Engine components |
| game-v3 | `frontend/src/features/game-v3/` | Game V3 wizard |
| play | `frontend/src/features/play/` | Play feature components |
| rulesets | `frontend/src/features/rulesets/` | Ruleset management hooks |

### Casting Circle Feature
**Location:** `frontend/src/features/casting-circle/`

**Components:**
- `CastingCircleWizard.tsx` - Main wizard component
- `steps/BindStone.tsx` - Bind stone step
- `steps/ElementsStone.tsx` - Elements stone step
- `steps/ForcesStone.tsx` - Forces stone step
- `steps/LoreStone.tsx` - Lore stone step
- `steps/NarrativeStone.tsx` - Narrative stone step
- `steps/WorldStone.tsx` - World stone step

**Stores:**
- `stores/useStoryDraftStore.ts` - Story draft state

### Create Story Feature
**Location:** `frontend/src/features/create-story/`

**Components:**
- `components/CreateStoryPage.tsx` - Main page
- `components/StoryWizardLayout.tsx` - Wizard layout
- `components/Step1_World.tsx` - World selection step
- `components/Step2_Forces.tsx` - Forces step
- `components/Step3_Elements.tsx` - Elements step
- `components/Step4_Lore.tsx` - Lore step
- `components/Step5_Compile.tsx` - Compile step
- `components/NarrativeStep.tsx` - Narrative step
- `components/CreateWorldModal.tsx` - World creation modal
- `components/CreateEntityModal.tsx` - Entity creation modal
- `components/EntityBrowser.tsx` - Entity browser
- `components/EntityCard.tsx` - Entity card
- `components/EntityManagerModal.tsx` - Entity manager modal
- `components/LoreManagerModal.tsx` - Lore manager modal
- `components/RulesetFilterBar.tsx` - Ruleset filter bar

**Stores:**
- `store/useStoryDraftStore.ts` - Story draft state

**Data:**
- `data/mock-library.ts` - Mock library data
- `data/mock-playstyles.ts` - Mock playstyles
- `data/mock-rulesets.ts` - Mock rulesets
- `data/mock-world-presets.ts` - Mock world presets
- `data/mock-worlds.ts` - Mock worlds

**Utils:**
- `utils/ruleset-interpreter.ts` - Ruleset interpreter

### Play Feature
**Location:** `frontend/src/features/play/`

**Components:**
- `components/Deck/InputDeck.tsx` - Input deck component
- `components/Deck/SuggestionRail.tsx` - Suggestion rail
- `components/FX/SensoryObserver.tsx` - Sensory effects observer
- `components/HUD/EntitySidebar.tsx` - Entity sidebar
- `components/HUD/HUDManager.tsx` - HUD manager
- `components/HUD/SceneDeck.tsx` - Scene deck
- `components/HUD/VitalGauge.tsx` - Vital gauge
- `components/Inspector/EntityCard.tsx` - Entity card
- `components/Inspector/InspectorPanel.tsx` - Inspector panel
- `components/Narrative/EntityLink.tsx` - Entity link
- `components/Narrative/NarrativeStream.tsx` - Narrative stream
- `components/Narrative/StoryBlock.tsx` - Story block
- `components/Narrative/SystemLine.tsx` - System line
- `components/Narrative/TurnBlock.tsx` - Turn block
- `components/Narrative/types.ts` - Narrative types

**Layout:**
- `layout/ActiveGameLayout.tsx` - Active game layout

**Start:**
- `start/StartStoryPage.tsx` - Start story page
- `start/StartGatewayPage.tsx` - Start gateway page
- `start/components/CharacterSelector.tsx` - Character selector
- `start/data/premades.ts` - Premade characters
- `start/utils/schemaMerger.ts` - Schema merger utility

**Create:**
- `create/CharacterCreatorWizard.tsx` - Character creator wizard
- `create/components/DynamicControl.tsx` - Dynamic control
- `create/components/LiveCharacterSheet.tsx` - Live character sheet
- `create/steps/Step1_Identity.tsx` - Identity step
- `create/steps/Step2_Attributes.tsx` - Attributes step
- `create/steps/Step2_Capabilities.tsx` - Capabilities step
- `create/steps/Step3_Personality.tsx` - Personality step
- `create/utils/schemaSplitter.ts` - Schema splitter utility

**Utils:**
- `utils/text-parser.tsx` - Text parser

### Dashboard Feature
**Location:** `frontend/src/features/dashboard/`

**Components:**
- `components/AssetDomainCard.tsx` - Asset domain card
- `components/assets/AssetPickerModal.tsx` - Asset picker modal
- `components/cards/EntityCard.tsx` - Entity card
- `components/cards/StoryCard.tsx` - Story card
- `components/cards/WorldCard.tsx` - World card
- `components/editors/config/LoreManager.tsx` - Lore manager
- `components/editors/config/PresetSelector.tsx` - Preset selector
- `components/editors/config/RulesetConfigurator.tsx` - Ruleset configurator
- `components/editors/config/RulesetInfoModal.tsx` - Ruleset info modal
- `components/editors/EntityEditorModal.tsx` - Entity editor modal
- `components/editors/forms/EntityDetailsForm.tsx` - Entity details form
- `components/editors/forms/EntityIdentityForm.tsx` - Entity identity form
- `components/editors/shared/EditorLayout.tsx` - Editor layout
- `components/editors/shared/GuidedEditorLayout.tsx` - Guided editor layout
- `components/editors/WorldEditorModal.tsx` - World editor modal
- `components/RecentContextFeed.tsx` - Recent context feed
- `components/StoryListSection.tsx` - Story list section

**Pages:**
- `MyCreationsPage.tsx` - My creations page

---

## Components

### Component Categories

#### Admin Components
**Location:** `frontend/src/components/admin/`

| Component | File | Description |
|-----------|------|-------------|
| AdminRoute | `admin/AdminRoute.tsx` | Admin route wrapper |
| ExtrasForm | `admin/ExtrasForm.tsx` | Extras form |
| FieldEditor | `admin/FieldEditor.tsx` | Field editor |
| GalleryManager | `admin/GalleryManager.tsx` | Gallery manager |
| GraphCanvas | `admin/graph/GraphCanvas.tsx` | Graph canvas |
| EdgeInspector | `admin/graph/EdgeInspector.tsx` | Edge inspector |
| LintPanel | `admin/graph/LintPanel.tsx` | Lint panel |
| NodeInspector | `admin/graph/NodeInspector.tsx` | Node inspector |
| ApprovalsTable | `admin/media/ApprovalsTable.tsx` | Media approvals table |
| TimeseriesChart | `admin/metrics/TimeseriesChart.tsx` | Timeseries chart |
| TopList | `admin/metrics/TopList.tsx` | Top list |
| PreviewControls | `admin/preview/PreviewControls.tsx` | Preview controls |
| PreviewMetaBar | `admin/preview/PreviewMetaBar.tsx` | Preview meta bar |
| PreviewPiecesTable | `admin/preview/PreviewPiecesTable.tsx` | Preview pieces table |
| PreviewPromptPanel | `admin/preview/PreviewPromptPanel.tsx` | Preview prompt panel |
| PreviewQASection | `admin/preview/PreviewQASection.tsx` | Preview QA section |
| PromptPreviewForm | `admin/PromptPreviewForm.tsx` | Prompt preview form |
| PromptPreviewResult | `admin/PromptPreviewResult.tsx` | Prompt preview result |
| SnapshotDiff | `admin/SnapshotDiff.tsx` | Snapshot diff |
| SnapshotList | `admin/SnapshotList.tsx` | Snapshot list |
| SnapshotOverrideDialog | `admin/SnapshotOverrideDialog.tsx` | Snapshot override dialog |
| SnapshotView | `admin/SnapshotView.tsx` | Snapshot view |
| TemplatesVersionSelect | `admin/TemplatesVersionSelect.tsx` | Templates version select |

#### Auth Components
**Location:** `frontend/src/components/auth/`

| Component | File | Description |
|-----------|------|-------------|
| ProtectedRoute | `auth/ProtectedRoute.tsx` | Route guard for authenticated users |
| EarlyAccessRoute | `auth/EarlyAccessRoute.tsx` | Route guard for early access users |
| GatedRoute | `auth/GatedRoute.tsx` | Generic gated route |

#### Game Components
**Location:** `frontend/src/components/game/`

| Component | File | Description |
|-----------|------|-------------|
| ActiveGameInterface | `game/ActiveGameInterface.tsx` | Active game interface |
| ActionInput | `game/ActionInput.tsx` | Action input component |
| GameGenesisLoader | `game/GameGenesisLoader.tsx` | Game genesis loader |
| NarrativeFeed | `game/NarrativeFeed.tsx` | Narrative feed |
| StatsPanel | `game/StatsPanel.tsx` | Stats panel |
| CastTray | `game/hud/CastTray.tsx` | Cast tray |
| VitalsCluster | `game/hud/VitalsCluster.tsx` | Vitals cluster |
| GameLayout | `game/layout/GameLayout.tsx` | Game layout |
| NarrativeBlock | `game/feed/NarrativeBlock.tsx` | Narrative block |
| SystemMessage | `game/feed/SystemMessage.tsx` | System message |

#### Layout Components
**Location:** `frontend/src/components/layout/`

| Component | File | Description |
|-----------|------|-------------|
| AppLayout | `layout/AppLayout.tsx` | Main app layout wrapper |
| AdminLayout | `layout/AdminLayout.tsx` | Admin layout |
| MarketingShell | `layout/MarketingShell.tsx` | Marketing shell |
| ExploreShell | `layout/ExploreShell.tsx` | Explore shell |
| PlayShell | `layout/PlayShell.tsx` | Play shell |
| AccountLegalShell | `layout/AccountLegalShell.tsx` | Account/legal shell |
| CharacterForgeLayout | `layout/CharacterForgeLayout.tsx` | Character forge layout |
| GlobalHeader | `layout/GlobalHeader.tsx` | Global header |
| GlobalFooter | `layout/GlobalFooter.tsx` | Global footer |
| Breadcrumbs | `layout/Breadcrumbs.tsx` | Breadcrumbs |
| MobileDrawerNav | `layout/MobileDrawerNav.tsx` | Mobile drawer navigation |
| PlayBottomNav | `layout/PlayBottomNav.tsx` | Play bottom navigation |
| PlayBottomSheet | `layout/PlayBottomSheet.tsx` | Play bottom sheet |

#### Play Components
**Location:** `frontend/src/components/play/`

| Component | File | Description |
|-----------|------|-------------|
| PlayInput | `play/PlayInput.tsx` | Play input component |
| CharacterCard | `play/CharacterCard.tsx` | Character card |
| CharacterModal | `play/CharacterModal.tsx` | Character modal |
| MessageLog | `play/MessageLog.tsx` | Message log |
| StoryStartSummary | `play/StoryStartSummary.tsx` | Story start summary |
| DebugPanel | `play/DebugPanel.tsx` | Debug panel |

#### Chimera Components
**Location:** `frontend/src/components/chimera/`

| Component | File | Description |
|-----------|------|-------------|
| CharacterReviewSheet | `chimera/CharacterReviewSheet.tsx` | Character review sheet |
| ComplexAssetSelector | `chimera/ComplexAssetSelector.tsx` | Complex asset selector |
| DynamicSchemaField | `chimera/DynamicSchemaField.tsx` | Dynamic schema field |
| EntityAttributesForm | `chimera/EntityAttributesForm.tsx` | Entity attributes form |
| CreateEntityModal | `chimera/modals/CreateEntityModal.tsx` | Create entity modal |
| CreateLoreModal | `chimera/modals/CreateLoreModal.tsx` | Create lore modal |
| TagSelect | `chimera/TagSelect.tsx` | Tag select |

#### Common Components
**Location:** `frontend/src/components/common/`

| Component | File | Description |
|-----------|------|-------------|
| CollapsibleSection | `common/CollapsibleSection.tsx` | Collapsible section |
| CoverImagePanel | `common/CoverImagePanel.tsx` | Cover image panel |
| MediaUploader | `common/MediaUploader.tsx` | Media uploader |
| ResourceGrid | `common/ResourceGrid.tsx` | Resource grid |
| SectionHeader | `common/SectionHeader.tsx` | Section header |
| Fields | `common/fields/` | Form field components (6 files) |

#### Catalog Components
**Location:** `frontend/src/components/catalog/`

| Component | File | Description |
|-----------|------|-------------|
| CatalogCard | `catalog/CatalogCard.tsx` | Catalog card |
| CatalogChip | `catalog/CatalogChip.tsx` | Catalog chip |
| CatalogGrid | `catalog/CatalogGrid.tsx` | Catalog grid |
| CatalogSkeleton | `catalog/CatalogSkeleton.tsx` | Catalog skeleton |
| EmptyState | `catalog/EmptyState.tsx` | Empty state |
| EntryPointCard | `catalog/EntryPointCard.tsx` | Entry point card |

#### Filter Components
**Location:** `frontend/src/components/filters/`

| Component | File | Description |
|-----------|------|-------------|
| StoriesFilterBar | `filters/StoriesFilterBar.tsx` | Stories filter bar |
| WorldsFilterBar | `filters/WorldsFilterBar.tsx` | Worlds filter bar |
| NPCsFilterBar | `filters/NPCsFilterBar.tsx` | NPCs filter bar |
| RulesetsFilterBar | `filters/RulesetsFilterBar.tsx` | Rulesets filter bar |

#### Debug Components
**Location:** `frontend/src/components/debug/`

| Component | File | Description |
|-----------|------|-------------|
| AIDebugPanel | `debug/AIDebugPanel.tsx` | AI debug panel |
| CodeBlock | `debug/CodeBlock.tsx` | Code block |
| ComparePromptView | `debug/ComparePromptView.tsx` | Compare prompt view |
| CompareView | `debug/CompareView.tsx` | Compare view |
| DebugDrawer | `debug/DebugDrawer.tsx` | Debug drawer |
| DebugPanel | `debug/DebugPanel.tsx` | Debug panel |
| DebugTabs | `debug/DebugTabs.tsx` | Debug tabs |
| SchemaDebug | `debug/SchemaDebug.tsx` | Schema debug |
| TurnPicker | `debug/TurnPicker.tsx` | Turn picker |

---

## Services

**Location:** `frontend/src/services/`

### Service Files

| Service | File | Description |
|---------|------|-------------|
| chimera-api | `services/chimera-api.ts` | Base Chimera API client |
| chimera-v3 | `services/chimera-v3.ts` | Chimera V3 API client |
| chimera.play | `services/chimera.play.ts` | Play/game API |
| chimera.stories | `services/chimera.stories.ts` | Stories API |
| chimera.worlds | `services/chimera.worlds.ts` | Worlds API |
| chimera.entities | `services/chimera.entities.ts` | Entities API |
| chimera.lore | `services/chimera.lore.ts` | Lore API |
| chimera.lore-entries | `services/chimera.lore-entries.ts` | Lore entries API |
| chimera.packs | `services/chimera.packs.ts` | Packs API |
| chimera.profile | `services/chimera.profile.ts` | Profile API |
| game-client | `services/game-client.ts` | Game client |
| catalog | `services/catalog.ts` | Catalog service |
| auth.service | `services/auth.service.ts` | Auth service |
| profile | `services/profile.ts` | Profile service |
| refs | `services/refs.ts` | Refs service |
| validation | `services/validation.ts` | Validation service |
| guestCookie | `services/guestCookie.ts` | Guest cookie service |
| guestLinking | `services/guestLinking.ts` | Guest linking service |
| routePreservation | `services/routePreservation.ts` | Route preservation service |
| telemetry | `services/telemetry.ts` | Telemetry service |
| cloudSyncClient | `services/cloudSyncClient.ts` | Cloud sync client |
| mockData | `services/mockData.ts` | Mock data service |

### Admin Services
**Location:** `frontend/src/services/`

| Service | File | Description |
|---------|------|-------------|
| adminService | `services/adminService.ts` | Main admin service |
| admin.accessRequests | `services/admin.accessRequests.ts` | Access requests |
| admin.bundlePreview | `services/admin.bundlePreview.ts` | Bundle preview |
| admin.chimera | `services/admin.chimera.ts` | Chimera admin |
| admin.entryLinks | `services/admin.entryLinks.ts` | Entry links |
| admin.entryPoints | `services/admin.entryPoints.ts` | Entry points |
| admin.media | `services/admin.media.ts` | Media admin |
| admin.npcBindings | `services/admin.npcBindings.ts` | NPC bindings |
| admin.npcPacks | `services/admin.npcPacks.ts` | NPC packs |
| admin.npcSegments | `services/admin.npcSegments.ts` | NPC segments |
| admin.refs | `services/admin.refs.ts` | Admin refs |
| admin.roles | `services/admin.roles.ts` | Roles admin |
| admin.segments | `services/admin.segments.ts` | Segments admin |
| accessRequests | `services/accessRequests.ts` | Access requests (non-admin) |

### Authoring Services
**Location:** `frontend/src/services/authoring/`

| Service | File | Description |
|---------|------|-------------|
| worlds.service | `authoring/worlds.service.ts` | Worlds authoring |
| entities.service | `authoring/entities.service.ts` | Entities authoring |

### Player Services
**Location:** `frontend/src/services/player/`

| Service | File | Description |
|---------|------|-------------|
| PlayerAccountService | `player/PlayerAccountService.ts` | Player account service |

### Auth Services
**Location:** `frontend/src/services/auth/`

| Service | File | Description |
|---------|------|-------------|
| AuthService | `auth/AuthService.ts` | Auth service implementation |

---

## Hooks

**Location:** `frontend/src/hooks/`

### Custom Hooks

| Hook | File | Description |
|------|------|-------------|
| useAuth | `hooks/useAuth.ts` | Authentication hook |
| useAuthRedirect | `hooks/useAuthRedirect.ts` | Auth redirect logic |
| useAdminRole | `hooks/useAdminRole.ts` | Admin role check |
| useAdminService | `hooks/useAdminService.ts` | Admin service hook |
| useAppConfig | `hooks/useAppConfig.ts` | App config hook |
| useCatalog | `hooks/useCatalog.ts` | Catalog hook |
| useWorlds | `hooks/useWorlds.ts` | Worlds hook |
| useNPCs | `hooks/useNPCs.ts` | NPCs hook |
| useNPCPacks | `hooks/useNPCPacks.ts` | NPC packs hook |
| useRulesets | `hooks/useRulesets.ts` | Rulesets hook |
| useTurns | `hooks/useTurns.ts` | Turns hook |
| useStartAdventure | `hooks/useStartAdventure.ts` | Start adventure hook |
| usePlayerAccount | `hooks/usePlayerAccount.ts` | Player account hook |
| useGameTelemetry | `hooks/useGameTelemetry.ts` | Game telemetry hook |
| useAdventureTelemetry | `hooks/useAdventureTelemetry.ts` | Adventure telemetry hook |
| useSubmitForPublish | `hooks/useSubmitForPublish.ts` | Submit for publish hook |
| usePendingMedia | `hooks/usePendingMedia.ts` | Pending media hook |
| useDebounce | `hooks/useDebounce.ts` | Debounce hook |
| useErrorHandler | `hooks/useErrorHandler.ts` | Error handler hook |
| useDebugPanel | `hooks/useDebugPanel.ts` | Debug panel hook |
| useLiveRegion | `hooks/useLiveRegion.ts` | Live region hook (a11y) |
| useEntry | `hooks/useEntry.ts` | Entry hook |
| usePrefetch | `lib/usePrefetch.ts` | Prefetch hook |

### Feature-Specific Hooks
| Hook | File | Description |
|------|------|-------------|
| useGameSession | `hooks/game/useGameSession.ts` | Game session hook |
| useEntitySchema | `hooks/chimera/useEntitySchema.ts` | Entity schema hook |
| useRulesetSelectionManager | `features/rulesets/hooks/useRulesetSelectionManager.tsx` | Ruleset selection manager |
| useRulesetSchema | `features/engine/hooks/useRulesetSchema.ts` | Ruleset schema hook |

---

## Stores

**Location:** `frontend/src/stores/` (Zustand stores)

### Store Files

| Store | File | Description |
|-------|------|-------------|
| useActiveGameStore | `stores/useActiveGameStore.ts` | Active game state |
| useCharacterDraftStore | `stores/useCharacterDraftStore.ts` | Character draft state |
| useCastingStore | `stores/useCastingStore.ts` | Casting state |
| useGameSettings | `stores/useGameSettings.ts` | Game settings |
| adminStore | `stores/adminStore.ts` | Admin store |

### Legacy Stores
**Location:** `frontend/src/store/`

| Store | File | Description |
|-------|------|-------------|
| auth | `store/auth.ts` | Auth store (legacy) |
| game | `store/game.ts` | Game store (legacy) |
| studio | `store/studio.ts` | Studio store (legacy) |

---

## Types

**Location:** `frontend/src/types/`

### Type Files

| Type File | File | Description |
|-----------|------|-------------|
| aliases | `types/aliases.ts` | Type aliases |
| catalog | `types/catalog.ts` | Catalog types |
| chimera-domain | `types/chimera-domain.ts` | Chimera domain types |
| chimera-form | `types/chimera-form.ts` | Chimera form types |
| chimera-v2 | `types/chimera-v2.ts` | Chimera V2 types |
| domain | `types/domain.ts` | Domain types |

---

## UI Components

**Location:** `frontend/src/components/ui/` (shadcn/ui components)

### UI Component Files

| Component | File | Description |
|-----------|------|-------------|
| accordion | `ui/accordion.tsx` | Accordion |
| alert | `ui/alert.tsx` | Alert |
| avatar | `ui/avatar.tsx` | Avatar |
| badge | `ui/badge.tsx` | Badge |
| breadcrumb | `ui/breadcrumb.tsx` | Breadcrumb |
| button | `ui/button.tsx` | Button |
| card | `ui/card.tsx` | Card |
| checkbox | `ui/checkbox.tsx` | Checkbox |
| collapsible | `ui/collapsible.tsx` | Collapsible |
| command | `ui/command.tsx` | Command palette |
| confirmation-dialog | `ui/confirmation-dialog.tsx` | Confirmation dialog |
| data-list | `ui/data-list.tsx` | Data list |
| data-table | `ui/data-table.tsx` | Data table |
| dialog | `ui/dialog.tsx` | Dialog |
| dropdown-menu | `ui/dropdown-menu.tsx` | Dropdown menu |
| error-banner | `ui/error-banner.tsx` | Error banner |
| filter-panel | `ui/filter-panel.tsx` | Filter panel |
| form | `ui/form.tsx` | Form |
| form-field | `ui/form-field.tsx` | Form field |
| ImageUploader | `ui/ImageUploader.tsx` | Image uploader |
| input | `ui/input.tsx` | Input |
| label | `ui/label.tsx` | Label |
| limit-banner | `ui/limit-banner.tsx` | Limit banner |
| loading-spinner | `ui/loading-spinner.tsx` | Loading spinner |
| navigation-menu | `ui/navigation-menu.tsx` | Navigation menu |
| popover | `ui/popover.tsx` | Popover |
| progress | `ui/progress.tsx` | Progress |
| radio-group | `ui/radio-group.tsx` | Radio group |
| scroll-area | `ui/scroll-area.tsx` | Scroll area |
| select | `ui/select.tsx` | Select |
| separator | `ui/separator.tsx` | Separator |
| sheet | `ui/sheet.tsx` | Sheet |
| skeleton | `ui/skeleton.tsx` | Skeleton |
| skip-navigation | `ui/skip-navigation.tsx` | Skip navigation (a11y) |
| slider | `ui/slider.tsx` | Slider |
| sonner | `ui/sonner.tsx` | Toast notifications |
| switch | `ui/switch.tsx` | Switch |
| table | `ui/table.tsx` | Table |
| tabs | `ui/tabs.tsx` | Tabs |
| textarea | `ui/textarea.tsx` | Textarea |
| tier-gate | `ui/tier-gate.tsx` | Tier gate |
| toast-provider | `ui/toast-provider.tsx` | Toast provider |
| tooltip | `ui/tooltip.tsx` | Tooltip |
| use-form-field | `ui/use-form-field.ts` | Form field hook |

### Variant Files
- `ui/badge-variants.ts` - Badge variants
- `ui/button-variants.ts` - Button variants
- `ui/card-base.tsx` - Card base
- `ui/navigation-menu-styles.ts` - Navigation menu styles

---

## Configuration

### Build Configuration
- **Vite Config:** `frontend/vite.config.ts`
- **TypeScript Config:** `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`
- **ESLint Config:** `frontend/eslint.config.js`
- **Tailwind Config:** `frontend/tailwind.config.js`
- **PostCSS Config:** `frontend/postcss.config.js`
- **Playwright Config:** `frontend/playwright.config.ts`
- **Vitest Config:** `frontend/vitest.config.ts`

### Environment
- **API Base:** `frontend/src/lib/apiBase.ts` - Centralized API base URL
- **Supabase Client:** `frontend/src/lib/supabase.ts` - Supabase client initialization
- **Query Client:** `frontend/src/lib/queryClient.ts` - React Query client configuration

### Feature Flags
- **Config:** `frontend/src/config/features.ts` - Feature flags

### Providers
**Location:** `frontend/src/providers/`

| Provider | File | Description |
|----------|------|-------------|
| AuthProvider | `providers/AuthProvider.tsx` | Auth context provider |
| AccessStatusProvider | `providers/AccessStatusProvider.tsx` | Access status provider |
| WalletProvider | `providers/WalletProvider.tsx` | Wallet provider |

### Contexts
**Location:** `frontend/src/contexts/`

| Context | File | Description |
|---------|------|-------------|
| ThemeProvider | `contexts/theme-context-provider.tsx` | Theme provider |
| ThemeContext | `contexts/theme-context.tsx` | Theme context |
| useTheme | `contexts/use-theme.ts` | Theme hook |

---

## Layout System

### Layout Variants
**File:** `frontend/src/components/layout/AppLayout.tsx`

| Variant | Routes | Shell Component |
|---------|--------|-----------------|
| marketing | `/`, `/faq`, `/about`, `/contact` | MarketingShell |
| explore | Catalog pages (`/stories`, `/worlds`, `/npcs`, `/rulesets`) | ExploreShell |
| play | `/play/*`, `/game/*`, `/characters/*` | PlayShell |
| account-legal | `/payments`, `/profile`, `/tos`, `/privacy`, `/ai-disclaimer` | AccountLegalShell |
| admin | `/admin/*` | AdminLayout |

---

## Testing

### Test Structure
- **Unit Tests:** `frontend/src/tests/`, `frontend/src/**/__tests__/`
- **E2E Tests:** `frontend/e2e/`
- **Test Setup:** `frontend/src/test/setup.ts`

### Test Files
- **Vitest:** Unit tests using Vitest
- **Playwright:** E2E tests using Playwright
- **Testing Library:** React component tests

---

## Notes

### Unknowns / Dynamic Behavior
- **GameStatePage usage:** `frontend/src/pages/play/GameStatePage.tsx` - Exact usage pattern unclear
- **Route preservation:** Exact preservation logic may vary by route
- **Admin route permissions:** Some routes may have dynamic permission checks beyond listed guards

### Legacy Code
- **Legacy stores:** `frontend/src/store/` contains legacy auth/game/studio stores
- **Legacy routes:** Some routes redirect to new equivalents (see [Legacy Redirects](#legacy-redirects))

### File Patterns to Avoid
Per architecture rules, these patterns are **FORBIDDEN**:
- `awf_*` files
- `stone_*` files  
- `mod_*` files

---

**Document Status:** Factual map of existing codebase. Does not infer features or flows not explicitly present in code.

