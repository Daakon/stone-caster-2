# Frontend Page Flow Map

**Last Updated:** 2025-01-XX  
**Purpose:** Runtime flow documentation for all route-level page components. Maps navigation paths, component render trees, and state dependencies.

---

## Table of Contents

1. [Public Pages](#public-pages)
2. [Catalog Pages](#catalog-pages)
3. [Play Pages](#play-pages)
4. [Creation Pages](#creation-pages)
5. [Dashboard Pages](#dashboard-pages)
6. [Settings Pages](#settings-pages)
7. [Admin Pages](#admin-pages)

---

## Public Pages

### LandingPage
**File:** `frontend/src/pages/LandingPage.tsx`  
**Route:** `/`

#### Page Summary
Marketing landing page with hero section, features, and early access handling.

#### Inbound Paths
- **Direct route entry:** `/` (default route)
- **Programmatic redirect:** Early access errors redirect to `/` (via `window.location.href = '/'` in `App.tsx`)
- **OAuth callback:** Handles `?code=` and `?state=` query params

#### Outbound Paths
- **Button:** "Explore Stories" → `/stories` (conditional: `hasApprovedAccess`)
- **Button:** "Explore Worlds" → `/worlds` (conditional: `!hasApprovedAccess`)
- **Button:** "Sign In" → `/auth/signin` (conditional: `!hasApprovedAccess`)

#### Render Tree
```
AppLayout (MarketingShell)
  └─ EarlyAccessBanner
  └─ LandingPage
      ├─ Hero Section
      │   ├─ Email Form (conditional: `!isAuthenticated && !needsEarlyAccess`)
      │   └─ Action Buttons (conditional: `!needsEarlyAccess`)
      ├─ Features Section
      │   └─ Feature Cards (6 items)
      └─ DrifterBubble (conditional: `showDrifter`, delayed 2000ms)
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useAuthStore` | Store | Initial render | Yes |
| `useAccessStatusContext` | Context | Initial render | Yes |
| `useNavigate` | Hook | On button click | No |
| `useSearchParams` | Hook | OAuth callback detection | No |
| `GuestCookieService.getOrCreateGuestCookie()` | Service | App init (via App.tsx) | No |

---

### AuthPage
**File:** `frontend/src/pages/AuthPage.tsx`  
**Routes:** `/auth`, `/auth/signin`, `/auth/signup`

#### Page Summary
Authentication page with signin/signup tabs and OAuth providers.

#### Inbound Paths
- **Direct route entry:** `/auth`, `/auth/signin`, `/auth/signup`
- **Link navigation:** 
  - From `GlobalHeader` → `/auth/signin`
  - From `LandingPage` → `/auth/signin`
  - From `MobileDrawerNav` → `/auth/signin`, `/auth/signup`
- **Programmatic redirect:** `AuthRouter` redirects authenticated users away from auth pages

#### Outbound Paths
- **Form submit:** Email/password auth → `returnTo` URL (from query params or route preservation) or `/`
- **OAuth button:** Google/GitHub/Discord → External OAuth flow → `/auth/success`
- **Button:** "Continue as Guest" → `/`

#### Render Tree
```
AppLayout (MarketingShell)
  └─ AuthPage
      └─ Card
          ├─ CardHeader
          ├─ CardContent
          │   ├─ Alert (conditional: `error`)
          │   ├─ Tabs
          │   │   ├─ TabsList (Sign Up / Sign In)
          │   │   ├─ TabsContent (signup)
          │   │   │   └─ Form (email, password, submit)
          │   │   └─ TabsContent (signin)
          │   │       └─ Form (email, password, submit)
          │   ├─ Separator ("Or continue with")
          │   ├─ OAuth Buttons (Google, GitHub, Discord)
          │   └─ Button ("Continue as Guest")
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useAuthStore` | Store | Form submit, OAuth | Yes |
| `RoutePreservationService` | Service | Get intended route | No |
| `useNavigate` | Hook | On submit, guest button | No |
| `useSearchParams` | Hook | Get `returnTo` param | No |
| `useLocation` | Hook | Detect path mode | No |

---

### AuthSuccessPage
**File:** `frontend/src/pages/AuthSuccessPage.tsx`  
**Route:** `/auth/success`

#### Page Summary
OAuth callback handler page.

#### Inbound Paths
- **OAuth redirect:** External OAuth providers redirect here after authentication

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### RequestAccessPage
**File:** `frontend/src/pages/RequestAccessPage.tsx`  
**Route:** `/request-access`

#### Page Summary
Early access request form.

#### Inbound Paths
- **Direct route entry:** `/request-access`
- **Link navigation:** UNKNOWN (likely from header or landing page)

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### SupportPage
**File:** `frontend/src/pages/SupportPage.tsx`  
**Route:** `/support`

#### Page Summary
Support/FAQ page.

#### Inbound Paths
- **Direct route entry:** `/support`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### NotFoundPage
**File:** `frontend/src/pages/NotFoundPage.tsx`  
**Route:** `*` (catch-all)

#### Page Summary
404 error page.

#### Inbound Paths
- **Catch-all route:** Any unmatched route
- **Legacy redirects:** `/dashboard/stories/new`, `/dashboard/stories/edit/:id` → 404

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

## Catalog Pages

### StoriesPage
**File:** `frontend/src/pages/stories/StoriesPage.tsx`  
**Route:** `/stories`  
**Guard:** `ProtectedRoute`

#### Page Summary
Story catalog listing with search and filter.

#### Inbound Paths
- **Direct route entry:** `/stories`
- **Button:** From `LandingPage` → "Explore Stories" → `/stories`
- **Link:** From `StoryDetailPage` → "Back to Stories" → `/stories`
- **Link:** From `StartGatewayPage` → "Back to Stories" → `/stories`

#### Outbound Paths
- **CatalogCard click:** → `/stories/${story.slug || story.id}`

#### Render Tree
```
AppLayout (ExploreShell)
  └─ StoriesPage
      ├─ Header (h1, description)
      ├─ WorldsFilterBar (search input)
      ├─ Count display (conditional: stories loaded)
      └─ CatalogGrid
          └─ CatalogCard[] (per story)
              └─ Link → /stories/${id}
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useQuery` | Hook | Initial render | Yes |
| `useURLFilters` | Hook | Initial render | Yes |
| `trackCatalogView` | Service | On mount | No |
| `trackCatalogCardClick` | Service | On card click | No |
| `/api/catalog/stories` | API | Initial render | Yes |

---

### StoryDetailPage
**File:** `frontend/src/pages/stories/StoryDetailPage.tsx`  
**Route:** `/stories/:id`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
Story detail view with metadata, world info, and start button.

#### Inbound Paths
- **Link:** From `StoriesPage` → CatalogCard → `/stories/:id`
- **Link:** From `MyCreationsPage` → StoryCard → `/stories/:id`
- **Link:** From `StoryListSection` → `/stories/:id`

#### Outbound Paths
- **Button:** "Start Story" → `/play/start/${story.id}` (if Chimera enabled) OR `/stories/${story.id}/characters` (legacy)
- **Button:** "Go to Studio" → `/dashboard/stories/${id}/studio` (conditional: `showStudioButton`)
- **Button:** "Back to Stories" → `/stories`
- **Badge click:** World badge → `/worlds/${world.slug || world.id}`
- **Badge click:** Ruleset badge → `/rulesets/${ruleset.id}`
- **CatalogCard click:** Featured NPC → `/npcs/${npc.id}`
- **Button:** "Learn About World" → `/worlds/${story.world.id}`

#### Render Tree
```
AppLayout (ExploreShell)
  └─ StoryDetailPage
      ├─ Breadcrumbs
      └─ Grid (2 columns)
          ├─ Main Content (lg:col-span-2)
          │   ├─ Card (Hero)
          │   │   ├─ CardHeader (image)
          │   │   └─ CardContent
          │   │       ├─ Metadata (stones, time)
          │   │       ├─ Chips (world, rulesets, tags)
          │   │       ├─ Description
          │   │       └─ Action Buttons
          │   ├─ Card (World Rules) (conditional: `story.world`)
          │   ├─ Card (Differentiators) (conditional: `story.rulesets`)
          │   └─ Card (Featured NPCs) (conditional: `story.featured_npcs`)
          └─ Sidebar
              ├─ Card (Action Card)
              │   └─ Buttons (Start, Learn About World)
              └─ Card (World Info) (conditional: `story.world`)
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Initial render | Yes |
| `useQuery` | Hook | Initial render | Yes |
| `useStoryQuery` | Hook | Initial render (legacy) | Conditional |
| `chimeraStoriesService.getStory` | Service | Initial render (Chimera) | Conditional |
| `useAuthStore` | Store | Check ownership | No |
| `isChimeraEnabled` | Config | Route logic | Yes |
| `useNavigate` | Hook | On button click | No |
| `track` | Service | On start click | No |

---

### WorldsPage
**File:** `frontend/src/pages/worlds/WorldsPage.tsx`  
**Route:** `/worlds`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
World catalog listing with search.

#### Inbound Paths
- **Direct route entry:** `/worlds`
- **Button:** From `LandingPage` → "Explore Worlds" → `/worlds`

#### Outbound Paths
- **CatalogCard click:** → `/worlds/${world.slug || world.id}`

#### Render Tree
```
AppLayout (ExploreShell)
  └─ WorldsPage
      ├─ Header (h1, description)
      ├─ WorldsFilterBar (search input)
      ├─ Count display (conditional: worlds loaded)
      └─ CatalogGrid
          └─ CatalogCard[] (per world)
              └─ Link → /worlds/${id}
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useQuery` | Hook | Initial render | Yes |
| `useURLFilters` | Hook | Initial render | Yes |
| `trackCatalogView` | Service | On mount | No |
| `trackCatalogCardClick` | Service | On card click | No |
| `/api/catalog/worlds` | API | Initial render | Yes |

---

### WorldDetailPage
**File:** `frontend/src/pages/worlds/WorldDetailPage.tsx`  
**Route:** `/worlds/:slug`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
World detail view.

#### Inbound Paths
- **Link:** From `WorldsPage` → CatalogCard → `/worlds/:slug`
- **Link:** From `StoryDetailPage` → World badge → `/worlds/:slug`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### NPCsPage
**File:** `frontend/src/pages/npcs/NPCsPage.tsx`  
**Route:** `/npcs`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
NPC catalog listing.

#### Inbound Paths
- **Direct route entry:** `/npcs`

#### Outbound Paths
- **CatalogCard click:** → `/npcs/${npc.slug || npc.id}`

#### Render Tree
- **UNKNOWN:** Component structure not analyzed (similar pattern to StoriesPage/WorldsPage)

#### State & Services
- **UNKNOWN:** Dependencies not analyzed (similar pattern to StoriesPage/WorldsPage)

---

### NPCDetailPage
**File:** `frontend/src/pages/npcs/NPCDetailPage.tsx`  
**Route:** `/npcs/:id`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
NPC detail view.

#### Inbound Paths
- **Link:** From `NPCsPage` → CatalogCard → `/npcs/:id`
- **Link:** From `StoryDetailPage` → Featured NPC card → `/npcs/:id`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### RulesetsPage
**File:** `frontend/src/pages/rulesets/RulesetsPage.tsx`  
**Route:** `/rulesets`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
Ruleset catalog listing.

#### Inbound Paths
- **Direct route entry:** `/rulesets`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### RulesetDetailPage
**File:** `frontend/src/pages/rulesets/RulesetDetailPage.tsx`  
**Route:** `/rulesets/:id`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
Ruleset detail view.

#### Inbound Paths
- **Link:** From `StoryDetailPage` → Ruleset badge → `/rulesets/:id`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

## Play Pages

### StartStoryPage
**File:** `frontend/src/features/play/start/StartStoryPage.tsx`  
**Route:** `/play/start/:storyId`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
Wrapper that renders `StartGatewayPage`.

#### Inbound Paths
- **Button:** From `StoryDetailPage` → "Start Story" → `/play/start/${story.id}`

#### Outbound Paths
- Delegates to `StartGatewayPage`

#### Render Tree
```
AppLayout (PlayShell)
  └─ StartStoryPage
      └─ StartGatewayPage
```

#### State & Services
- Delegates to `StartGatewayPage`

---

### StartGatewayPage
**File:** `frontend/src/features/play/start/StartGatewayPage.tsx`  
**Route:** `/play/start/:storyId` (via StartStoryPage)

#### Page Summary
Character selection gateway with tabs for existing characters and premades.

#### Inbound Paths
- **Component:** Rendered by `StartStoryPage`

#### Outbound Paths
- **Button:** "Back" → `/stories`
- **Button:** "Back to Stories" → `/stories`
- **Button:** "Go to Editor" → `/stories/${storyId}` (conditional: 404 error)
- **Character select:** → `/play/${gameStateId}` (via API call)
- **Premade select:** → `/play/create/${storyId}`
- **Button:** "Create New" → `/play/create/${storyId}`

#### Render Tree
```
AppLayout (PlayShell)
  └─ StartGatewayPage
      ├─ Header (Back button, title)
      └─ Tabs
          ├─ TabsList (My Library / Quick Start)
          ├─ TabsContent (MY_CHARACTERS)
          │   └─ CharacterSelector
          │       ├─ Character grid
          │       └─ Button ("Create New")
          └─ TabsContent (PREMADES)
              └─ CharacterSelector
                  ├─ Premade grid
                  └─ Button ("Create New")
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Initial render | Yes |
| `useQuery` | Hook | Initial render | Yes |
| `getCompiledStory` | Service | Initial render | Yes |
| `getMyCharacters` | Service | Initial render | Yes |
| `apiPost` | Service | On character select | No |
| `useNavigate` | Hook | On navigation | No |
| `mergeCharacterSchema` | Util | Schema merge | Yes |

---

### CharacterCreatorPage
**File:** `frontend/src/pages/play/create/CharacterCreatorPage.tsx`  
**Route:** `/play/create/:storyId`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
Character creation wizard (V2 "Character Forge") with schema-driven form.

#### Inbound Paths
- **Button:** From `StartGatewayPage` → "Create New" → `/play/create/${storyId}`
- **Button:** From `StartGatewayPage` → Premade select → `/play/create/${storyId}`

#### Outbound Paths
- **Button:** "Back to Stories" → `/stories`
- **Button:** "Go Back" → `/stories`
- **Form submit:** Finalize character → `/play/${gameStateId}` (via API call)
- **Error fallback:** → `/stories/${storyId}`

#### Render Tree
```
AppLayout (PlayShell)
  └─ CharacterCreatorPage
      ├─ CharacterForgeLayout
      │   ├─ Header (Back button, title)
      │   ├─ Progress indicator
      │   └─ EntityAttributesForm
      │       └─ Dynamic form fields (per step)
      └─ CharacterReviewSheet (conditional: review step)
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Initial render | Yes |
| `useQuery` | Hook | Initial render | Yes |
| `getCreationManifest` | Service | Initial render | Yes |
| `useEntitySchema` | Hook | Initial render | Yes |
| `useCharacterDraftStore` | Store | Form persistence | Yes |
| `useForm` | Hook | Form management | Yes |
| `useDebounce` | Hook | Autosave | No |
| `apiPost` | Service | On finalize | No |
| `useNavigate` | Hook | On navigation | No |

---

### GamePage
**File:** `frontend/src/pages/play/GamePage.tsx`  
**Route:** `/play/:gameStateId`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
Gameplay interface wrapper that delegates to `ActiveGameInterface`.

#### Inbound Paths
- **Programmatic:** From `StartGatewayPage` → Character select → `/play/${gameStateId}`
- **Programmatic:** From `CharacterCreatorPage` → Finalize → `/play/${gameStateId}`

#### Outbound Paths
- Delegates to `ActiveGameInterface`

#### Render Tree
```
AppLayout (PlayShell - Immersive Mode, no header/footer)
  └─ GamePage
      └─ ActiveGameInterface
```

#### State & Services
- Delegates to `ActiveGameInterface`

---

### ActiveGameInterface
**File:** `frontend/src/components/game/ActiveGameInterface.tsx`  
**Route:** Rendered by `GamePage`

#### Page Summary
Main game loop interface with narrative stream, HUD, and input deck.

#### Inbound Paths
- **Component:** Rendered by `GamePage`

#### Outbound Paths
- **Button:** Error fallback → `/casting-circle` (UNKNOWN: route may not exist)

#### Render Tree
```
AppLayout (PlayShell - Immersive Mode)
  └─ ActiveGameInterface
      └─ GameLayout
          ├─ Background layer
          ├─ Main content (NarrativeStream)
          ├─ Header slot (SceneDeck)
          ├─ Vitals slot (VitalsCluster)
          ├─ Tray slot (CastTray)
          └─ Footer slot
              ├─ SuggestionRail
              └─ InputDeck
      └─ InspectorPanel
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Get gameStateId | Yes |
| `useQuery` | Hook | Load game state | Yes |
| `loadState` | Service | Initial render | Yes |
| `castStone` | Service | On input commit | No |
| `useActiveGameStore` | Store | Game state management | Yes |
| `useGameSettings` | Store | Zen mode | No |
| `useNavigate` | Hook | Error navigation | No |
| `useQueryClient` | Hook | Invalidate queries | No |

---

### GameStatePage
**File:** `frontend/src/pages/play/GameStatePage.tsx`  
**Route:** UNKNOWN (not in App.tsx routes)

#### Page Summary
Alternative game state view (UNKNOWN: usage pattern unclear).

#### Inbound Paths
- **UNKNOWN:** Route not defined in App.tsx

#### Outbound Paths
- **Button:** Back button → `navigate(-1)`

#### Render Tree
```
AppLayout (PlayShell)
  └─ GameStatePage
      ├─ Header (Back button, story name)
      ├─ SensoryObserver
      ├─ NarrativeStream
      ├─ DebugPanel (conditional: `?debug=true`)
      └─ PlayInput (footer)
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Get gameStateId | Yes |
| `useQuery` | Hook | Load game state | Yes |
| `useMutation` | Hook | Cast stone | No |
| `chimeraPlayService.getGameState` | Service | Initial render | Yes |
| `chimeraStoriesService.getStory` | Service | Get story name | No |
| `useNavigate` | Hook | Back navigation | No |

---

### CharacterCreationPage
**File:** `frontend/src/pages/play/CharacterCreationPage.tsx`  
**Route:** `/create-character/:storyId`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
Legacy character creation page.

#### Inbound Paths
- **UNKNOWN:** Navigation sources not analyzed

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### PlayerGatewayPage
**File:** `frontend/src/pages/play/PlayerGatewayPage.tsx`  
**Route:** `/player-gateway/:storyId`  
**Guard:** `EarlyAccessRoute`

#### Page Summary
Player entry gateway.

#### Inbound Paths
- **UNKNOWN:** Navigation sources not analyzed

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

## Creation Pages

### CreateStoryPage
**File:** `frontend/src/features/create-story/components/CreateStoryPage.tsx`  
**Routes:** `/stories/compose`, `/create-story`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Story creation wizard orchestrator (deprecated, uses CastingCircleWizard).

#### Inbound Paths
- **Button:** From `MyCreationsPage` → "New Story" → `/stories/compose`
- **Link:** From `StoryListSection` → `/create-story?draftId=...`
- **Direct route entry:** `/stories/compose`, `/create-story`

#### Outbound Paths
- **Programmatic:** New draft → `/stories/${draftId}/compose/world`
- **Programmatic:** Step navigation → `/stories/${id}/compose/${stepSlug}`

#### Render Tree
```
AppLayout (ExploreShell)
  └─ CreateStoryPage
      └─ StoryWizardLayout
          ├─ Step1_World (conditional: step === 'world')
          ├─ Step2_Forces (conditional: step === 'forces')
          ├─ Step3_Elements (conditional: step === 'elements')
          ├─ Step4_Lore (conditional: step === 'lore')
          ├─ NarrativeStep (conditional: step === 'narrative')
          └─ Step5_Compile (conditional: step === 'bind')
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Get id, step | Yes |
| `useStoryDraftStore` | Store | Draft management | Yes |
| `useNavigate` | Hook | Step navigation | No |
| `useSearchParams` | Hook | Get draftId | No |

---

### CastingCircleWizard
**File:** `frontend/src/features/casting-circle/CastingCircleWizard.tsx`  
**Routes:** `/stories/:id/compose`, `/stories/:id/compose/:step`  
**Guard:** `ProtectedRoute`

#### Page Summary
Casting circle story editor wizard.

#### Inbound Paths
- **Programmatic:** From `CreateStoryPage` → `/stories/${id}/compose/world`
- **Link:** From `MyCreationsPage` → Story edit → `/stories/${story.id}/compose`
- **Link:** From `StoryListSection` → Edit → `/stories/${story.id}/compose`

#### Outbound Paths
- **Programmatic:** Step navigation → `/stories/${id}/compose/${step}`
- **Button:** Cancel → `/my-creations` or `/dashboard/creations`
- **Programmatic:** New story → `/stories/${newId}/compose/world`

#### Render Tree
```
AppLayout (ExploreShell)
  └─ CastingCircleWizard
      └─ StoryWizardLayout
          ├─ Step navigation tabs
          ├─ WorldStone (conditional: step === 'world')
          ├─ ForcesStone (conditional: step === 'forces')
          ├─ ElementsStone (conditional: step === 'elements')
          ├─ LoreStone (conditional: step === 'lore')
          ├─ NarrativeStone (conditional: step === 'narrative')
          └─ BindStone (conditional: step === 'bind')
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Get id, step | Yes |
| `useCastingStore` | Store | Wizard state | Yes |
| `useNavigate` | Hook | Step navigation | No |

---

### MyCreationsPage
**File:** `frontend/src/features/dashboard/MyCreationsPage.tsx`  
**Route:** `/my-creations`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Creator dashboard with tabs for stories, worlds, and entities.

#### Inbound Paths
- **Direct route entry:** `/my-creations`
- **Redirect:** From `/dashboard/creations` → `/my-creations`

#### Outbound Paths
- **Button:** "New Story" → `/stories/compose`
- **Button:** "Create World" → Opens `WorldEditorModal`
- **Button:** "Create Entity" → Opens `EntityEditorModal`
- **Link:** Story card → `/stories/${story.id}`
- **Button:** Story edit → `/stories/${story.id}/compose`
- **Button:** Story manage → `/dashboard/stories/${story.id}/manage`
- **Button:** World edit → Opens `WorldEditorModal` with world ID
- **Button:** Entity edit → Opens `EntityEditorModal` with entity ID

#### Render Tree
```
AppLayout (ExploreShell)
  └─ MyCreationsPage
      ├─ Header (title, description)
      └─ Tabs
          ├─ TabsList (Stories, Worlds, Entities)
          ├─ TabsContent (stories)
          │   ├─ SectionHeader ("Stories")
          │   ├─ Button ("New Story")
          │   └─ ResourceGrid
          │       └─ StoryCard[] (per story)
          ├─ TabsContent (worlds)
          │   ├─ SectionHeader ("Worlds")
          │   ├─ Button ("Create World")
          │   └─ ResourceGrid
          │       └─ WorldCard[] (per world)
          └─ TabsContent (entities)
              ├─ SectionHeader ("Entities")
              ├─ Button ("Create Entity")
              └─ ResourceGrid
                  └─ EntityCard[] (per entity)
      ├─ WorldEditorModal (conditional: `worldEditorOpen`)
      └─ EntityEditorModal (conditional: `entityEditorOpen`)
```

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useNavigate` | Hook | On navigation | No |
| `useSearchParams` | Hook | Get active tab | No |
| `useStoryDraftStore` | Store | Initialize draft | No |
| `useMyStories` | Hook | Load stories | Yes |
| `useMyWorlds` | Hook | Load worlds (conditional: tab === 'worlds') | Conditional |
| `useMyEntities` | Hook | Load entities (conditional: tab === 'entities') | Conditional |
| `useDeleteEntity` | Hook | Delete entity | No |
| `useDeleteStory` | Hook | Delete story | No |

---

### NewGameWizard
**File:** `frontend/src/features/game-v3/NewGameWizard.tsx`  
**Route:** `/story/:id/new`  
**Guard:** `ProtectedRoute`

#### Page Summary
New game wizard for V3 stories.

#### Inbound Paths
- **Link:** From `StoryCard` → `/story/${id}/new`

#### Outbound Paths
- **Programmatic:** Create game → `/play/v3/${instanceId}`

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Get story id | Yes |
| `useNavigate` | Hook | On create | No |

---

## Dashboard Pages

### WorldEditor
**File:** `frontend/src/pages/dashboard/worlds/Editor.tsx`  
**Routes:** `/dashboard/worlds/new`, `/dashboard/worlds/edit/:id`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
World editor form.

#### Inbound Paths
- **Link:** From `MyCreationsPage` → "Create World" → Opens modal (not route)
- **Link:** From `WorldsTab` → "New World" → `/dashboard/worlds/new`
- **Button:** From `WorldsTab` → Edit → `/dashboard/worlds/edit/${id}`

#### Outbound Paths
- **Button:** Cancel → `/dashboard/creations/worlds`
- **Form submit:** Save → `/dashboard/creations/worlds`

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Get id | Conditional |
| `useNavigate` | Hook | On cancel/save | No |

---

### WorldManage
**File:** `frontend/src/pages/dashboard/worlds/Manage.tsx`  
**Route:** `/dashboard/worlds/:id/manage`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
World management page.

#### Inbound Paths
- **UNKNOWN:** Navigation sources not analyzed

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### EntityEditor
**File:** `frontend/src/pages/dashboard/entities/Editor.tsx`  
**Routes:** `/dashboard/entities/new`, `/dashboard/entities/edit/:id`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Entity editor form.

#### Inbound Paths
- **Link:** From `MyCreationsPage` → "Create Entity" → Opens modal (not route)
- **Link:** From `EntitiesTab` → "New Entity" → `/dashboard/entities/new`
- **Button:** From `EntitiesTab` → Edit → `/dashboard/entities/edit/${id}`

#### Outbound Paths
- **Button:** Cancel → `/dashboard/creations/entities`
- **Form submit:** Save → `/dashboard/creations/entities`

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services

| Dependency | Type | When Used | Required |
|------------|------|-----------|----------|
| `useParams` | Hook | Get id | Conditional |
| `useNavigate` | Hook | On cancel/save | No |

---

### EntityManage
**File:** `frontend/src/pages/dashboard/entities/Manage.tsx`  
**Route:** `/dashboard/entities/:id/manage`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Entity management page.

#### Inbound Paths
- **UNKNOWN:** Navigation sources not analyzed

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### StoryStudio
**File:** `frontend/src/pages/dashboard/stories/Studio.tsx`  
**Route:** `/dashboard/stories/:id/studio`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Story studio editor.

#### Inbound Paths
- **Button:** From `StoryDetailPage` → "Go to Studio" → `/dashboard/stories/${id}/studio`
- **Button:** From `StoriesTab` → Manage → `/dashboard/stories/${story.id}/studio`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### StoryManage
**File:** `frontend/src/pages/dashboard/stories/Manage.tsx`  
**Route:** `/dashboard/stories/:id/manage`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Story management page.

#### Inbound Paths
- **Button:** From `StoriesTab` → Manage → `/dashboard/stories/${story.id}/manage`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### PackEditor
**File:** `frontend/src/pages/dashboard/packs/Editor.tsx`  
**Routes:** `/dashboard/packs/new`, `/dashboard/packs/edit/:id`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Pack editor form.

#### Inbound Paths
- **Link:** From `PacksTab` → "New Pack" → `/dashboard/packs/new`
- **Button:** From `PacksTab` → Edit → `/dashboard/packs/edit/${id}`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### PackManage
**File:** `frontend/src/pages/dashboard/packs/Manage.tsx`  
**Route:** `/dashboard/packs/:id/manage`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Pack management page.

#### Inbound Paths
- **UNKNOWN:** Navigation sources not analyzed

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### LoreEditor
**File:** `frontend/src/pages/dashboard/lore/Editor.tsx`  
**Routes:** `/dashboard/lore/new`, `/dashboard/lore/edit/:id`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Lore editor form.

#### Inbound Paths
- **Link:** From `LoreTab` → "New Lore" → `/dashboard/lore/new`
- **Button:** From `LoreTab` → Edit → `/dashboard/lore/edit/${id}`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### LoreManage
**File:** `frontend/src/pages/dashboard/lore/Manage.tsx`  
**Route:** `/dashboard/lore/:id/manage`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Lore management page.

#### Inbound Paths
- **UNKNOWN:** Navigation sources not analyzed

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

## Settings Pages

### ProfilePage
**File:** `frontend/src/pages/ProfilePage.tsx`  
**Route:** `/profile`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
User profile page.

#### Inbound Paths
- **Direct route entry:** `/profile`
- **Link:** From header/navigation → `/profile`

#### Outbound Paths
- **Link:** "Sign in or sign up" → `/auth` (conditional: guest user)

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

### CreatorProfileSettings
**File:** `frontend/src/pages/settings/CreatorProfile.tsx`  
**Route:** `/settings/profile`  
**Guard:** `ProtectedRoute` + `EarlyAccessRoute`

#### Page Summary
Creator profile settings.

#### Inbound Paths
- **Direct route entry:** `/settings/profile`

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

## Admin Pages

### Admin Pages Overview
**Base Route:** `/admin/*`  
**Guard:** `AdminRouteGuard`

All admin pages are routed through `AdminRouteGuard` which renders `AdminRoutes`. See `frontend/src/admin/AdminRoutes.tsx` for route definitions.

#### Common Inbound Paths
- **Direct route entry:** `/admin/*`
- **Link:** From `AdminLayout` navigation → Admin routes

#### Common Outbound Paths
- **Link:** Admin navigation links within `AdminLayout`

#### Common Render Tree
```
AppLayout (no shell wrapper)
  └─ AdminRouteGuard
      └─ AdminLayout
          └─ AdminRoutes
              └─ [Admin Page Component]
```

#### Common State & Services
- **Admin role check:** Via `AdminRouteGuard` and `routeGuard.tsx`
- **Admin service hooks:** `useAdminService`, `useAdminRole`

---

### AdminHome
**File:** `frontend/src/pages/admin/index.tsx`  
**Route:** `/admin`

#### Page Summary
Admin dashboard home.

#### Inbound Paths
- **Direct route entry:** `/admin`
- **Redirect:** `/admin/*` → `/admin` (catch-all)

#### Outbound Paths
- **UNKNOWN:** Navigation logic not visible in provided code

#### Render Tree
- **UNKNOWN:** Component structure not analyzed

#### State & Services
- **UNKNOWN:** Dependencies not analyzed

---

## Layout System

### AppLayout
**File:** `frontend/src/components/layout/AppLayout.tsx`

Determines layout shell based on route pathname:

| Variant | Routes | Shell Component |
|---------|--------|-----------------|
| `marketing` | `/`, `/faq`, `/about`, `/contact` | `MarketingShell` |
| `explore` | `/stories`, `/worlds`, `/npcs`, `/rulesets` | `ExploreShell` |
| `play` | `/play/*`, `/game/*`, `/characters/*` | `PlayShell` |
| `account-legal` | `/payments`, `/profile`, `/tos`, `/privacy`, `/ai-disclaimer` | `AccountLegalShell` |
| `admin` | `/admin/*` | None (renders children directly) |

### MarketingShell
**File:** `frontend/src/components/layout/MarketingShell.tsx`

```
MarketingShell
  ├─ GlobalHeader (variant="full")
  ├─ main#main-content
  │   └─ {children}
  └─ GlobalFooter
```

### ExploreShell
**File:** `frontend/src/components/layout/ExploreShell.tsx`

```
ExploreShell
  ├─ GlobalHeader (variant="full", showSearch={true})
  ├─ main#main-content
  │   └─ {children}
  └─ GlobalFooter
```

### PlayShell
**File:** `frontend/src/components/layout/PlayShell.tsx`

Conditional rendering:
- **Immersive Game** (`/play/[UUID]`): Renders children only (no header/footer)
- **Other Play Routes** (`/play/start/*`, `/play/create/*`): Uses `MobileDrawerNav`
- **Legacy Play Routes**: Uses `GlobalHeader` + `PlayBottomNav` + `PlayBottomSheet`

```
PlayShell (conditional)
  ├─ [Immersive Mode]
  │   └─ {children} (no wrapper)
  ├─ [Mobile Drawer Mode]
  │   └─ MobileDrawerNav
  │       └─ {children}
  └─ [Legacy Mode]
      ├─ GlobalHeader (variant="compact")
      ├─ main#main-content
      │   └─ {children}
      ├─ PlayBottomNav
      └─ PlayBottomSheet
```

### AccountLegalShell
**File:** `frontend/src/components/layout/AccountLegalShell.tsx`

- **UNKNOWN:** Component structure not analyzed

---

## Notes

### Unknowns / Dynamic Behavior
- **GameStatePage route:** Not defined in `App.tsx` routes, usage unclear
- **CharacterCreationPage:** Legacy page, exact usage pattern unclear
- **PlayerGatewayPage:** Exact usage pattern unclear
- **Many dashboard pages:** Component trees not fully analyzed
- **Admin pages:** Most component trees not analyzed
- **Settings pages:** Component trees not analyzed

### Conditional Flows
- **Early Access:** Many routes check `hasApprovedAccess` and redirect to `/` if not approved
- **Auth State:** `AuthRouter` redirects authenticated users away from auth pages
- **Chimera Feature Flag:** `isChimeraEnabled` affects story detail page routing logic
- **Immersive Mode:** `PlayShell` detects UUID pattern to determine layout mode

### Navigation Patterns
- **Route Preservation:** `RoutePreservationService` preserves intended route for post-auth redirect
- **Query Params:** Many pages use `useSearchParams` for tab state, filters, etc.
- **Programmatic Navigation:** Most navigation uses `useNavigate()` hook
- **Link Components:** Catalog pages use `Link` components for navigation

---

**Document Status:** Factual map of runtime flows. Pages marked as UNKNOWN require further code analysis.

