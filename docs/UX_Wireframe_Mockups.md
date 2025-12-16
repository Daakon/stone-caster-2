# 06 UX Visual Mockups
*(StoneCaster / Chimera Engine – MVP)*

This companion doc translates the detailed specs in `06_UX_Feature_Specs.md` into lightweight wireframes/visual notes. Each diagram references sections of the primary spec for behavior/logic.

---

## 1. Global Navigation & Layout Skeleton

```
┌───────────────────────────────────────────────────────────────────────┐
│ Logo        Worlds  NPCs  Stories                 My Stories  Creations│
│                                                                     ◉ │
└───────────────────────────────────────────────────────────────────────┘
                     ↑                      ↑                   ↑
                (Discovery)          (Player Hub)          (Author Hub)
```

- Sticky nav with three groupings (see §1.2–1.3 of feature spec).
- Mobile: collapse Discovery into horizontal scroll, move Profile into kebab menu.
- StoneCaster logo and **My Stories** both land on `/my-stories` for quick resumption of sessions.
- **Worlds** and **NPCs** open discovery browsers, which can chain into modals showing worlds, entities, and stories.
- **My Creations** routes to dashboard tabs; Stories tab links straight into Casting Circle via **Cast New Story**.

```mermaid
flowchart LR
    LogoMyStories["Logo / My Stories"]
    Worlds["Worlds"]
    NPCs["NPCs"]
    Stories["Stories"]
    MyCreations["My Creations"]
    Profile["Profile"]
    LogoMyStories --- Worlds
    Worlds --- NPCs
    NPCs --- Stories
    LogoMyStories --- MyCreations
    MyCreations --- Profile
```

---

## 2. Resource Browser Shell (`/worlds`, `/npcs`, `/stories`)

```
┌──── Filter Sidebar ────┐┌──────────── Cards Grid / Empty / Loading ──────┐
│ Search [__________]    ││┌────────────┐ ┌────────────┐ ┌────────────┐     │
│ Genres  [ ] Cozy       │││   Card     │ │   Card     │ │   Card     │ ... │
│ Rules   [x] D100       │││ Play CTA   │ │ Play CTA   │ │ Play CTA   │     │
│ Safety  [ ] Teen       ││└────────────┘ └────────────┘ └────────────┘     │
│ Reset Filters          ││                                                 │
└────────────────────────┘└─────────────────────────────────────────────────┘
```

- Cards open **Detail Modal** overlay (below). Search/sort/pagination controls align with §2.1 notes.

### Detail Modal Overlay (Shared)

```
┌────────────────────────────────────────────────────────────────────┐
│  Cover/Portrait      |  Tabs: Overview | Stories | Lore | ...      │
│  Quick Stats         |------------------------------------------------
│  Primary CTA (Play)  |  [Tab content scrolls independently]        │
│  Secondary CTA       |                                              │
└────────────────────────────────────────────────────────────────────┘
```

- Worlds: Tabs = Overview, Stories, Entities, Lore, Rulesets.
- NPCs: Overview, World, Stories, Lore, Relationships.
- Stories: Overview, World & Rules, Cast, Lore Hooks, Sessions.

#### Worlds Card Flow

```mermaid
flowchart LR
    WorldCard["World Card"]
    WModal["World Modal"]
    WStories["Stories Tab"]
    WEntities["Entities Tab"]
    WLore["Lore Tab"]
    WRules["Rulesets Tab"]
    WFollow["Follow / Actions"]
    WorldCard --> WModal
    WModal --> WStories -->|Play CTA| StoriesList["Story Cards"]
    WModal --> WEntities
    WModal --> WLore
    WModal --> WRules
    WModal --> WFollow
```

#### NPC Card Flow

```mermaid
flowchart LR
    NPCCard["NPC Card"]
    NModal["NPC Modal"]
    NWorld["World Tab"]
    NStories["Stories Tab"]
    NLore["Lore Tab"]
    NRelations["Relationships Tab"]
    NPCCard --> NModal
    NModal --> NWorld -->|Open World| WModal
    NModal --> NStories -->|Open Story| StoryModal
    NModal --> NLore
    NModal --> NRelations
```

#### Story Card Flow

```mermaid
flowchart LR
    StoryCard["Story Card"]
    SModal["Story Modal"]
    SWorld["World & Rules Tab"]
    SCast["Cast Tab"]
    SLore["Lore Hooks Tab"]
    SSessions["Sessions Tab (owners)"]
    SPlay["Play Now"]
    StoryCard --> SModal
    SModal --> SWorld -->|Open World| WModal
    SModal --> SCast -->|Open NPC| NModal
    SModal --> SLore
    SModal --> SSessions
    SModal --> SPlay --> SessionStart["/play/:sessionId"]
```

---

## 3. My Stories (`/my-stories`)

```
My Adventures                              + Sort ▼
┌────────────────────────────────────────────┐ ┌──────────────────────────┐
│ Cover │ Story Title        │ Resume  ▶     │ │ Cover │ Completed Story? │
│       │ Last Played 2d ago │ Abandon       │ │ ...   │ Resume disabled   │
│ Badges: World • Difficulty │ State: Dawn   │ │ ...   │ Archive CTA       │
└────────────────────────────────────────────┘ └──────────────────────────┘

Empty State:
[Compass Icon]
"No active adventures..."  [Browse Stories]
```

- Resume = primary action; Abandon triggers confirm modal per §2.2.

```mermaid
flowchart LR
    Sessions["Session Cards"]
    Resume["Resume CTA"]
    Abandon["Abandon CTA"]
    Confirm["Confirm Modal"]
    Play["/play/:sessionId"]
    Empty["Empty State Guidance"]
    Sessions --> Resume --> Play
    Sessions --> Abandon --> Confirm -->|Delete| Sessions
    Sessions -.no active?.-> Empty --> StoriesRoute["/stories (Browse)"]
    Sessions --> Metadata["State chips (Difficulty, World, Time Band)"]
```

---

## 3.1 Play Session Experience (`/play/:sessionId`)

```
┌─────────────── Game Log (scrollable) ───────────────┐┌─ State Sidebar ──┐
│ Narration chunk                                     ││ Time Band        │
│ [Resolution summary chips]                          ││ Conditions       │
│                                                     ││ NPC spotlight    │
│ Player action input history                         ││ Resources Bars   │
└─────────────────────────────────────────────────────┘└──────────────────┘
[Action Input Field____________________]  [Send ▶]
[System Controls: Undo? | Save | Help | View Lore Pulls]
```

**Functional Requirements**

1. **Action Input:** Supports multiline input, slash commands for emotes/system actions, and displays MAS-1 parsing tooltip on submit.
2. **Game Log:** Mixed timeline of narration, player entries, and system notices with ability to expand past turns or filter by narrator/system.
3. **State Sidebar:** Shows Tier1 stats (stamina, hunger), time band, location, party relationships, and condition badges; updates after each turn.
4. **Resolution Drawer:** Optional accordion that reveals full state_delta + mechanical rolls for debug/testing.
5. **Lore Peek:** Button to reveal which lore fragments MAS-2 pulled for transparency.
6. **Session Controls:** Resume/back to My Stories, Abandon, Download transcript (for authors), and bug report hook.

```mermaid
flowchart LR
    Input["Action Input"] --> MAS1["MAS-1 Parse"]
    MAS1 --> Engine["Engine Resolution"]
    Engine --> MAS2["MAS-2 Narrative"]
    MAS2 --> Log["Game Log"]
    Engine --> StateSidebar["State Sidebar Update"]
    MAS2 --> LorePeek["Lore Pulls"]
    Log --> SessionControls["Resume | Abandon | Transcript"]
```

---

## 4. Authoring Dashboard (`/dashboard`)

```
My Creations                              Alerts (Pending approvals)
┌─ Tabs ──────────────────────────────────────────────────────────────┐
│ Stories | Worlds | Entities                                        │
└────────────────────────────────────────────────────────────────────┘

Stories Tab Example:
[Cast New Story] (primary)
┌────────────────────────────────────────────────────────────────────┐
│ Title       | World      | Version | Status | Actions (Play, Manage)│
├────────────────────────────────────────────────────────────────────┤
│ Sunforge... | Emberwild  | v3      | Draft  | ▶ ⚙ 🗑               │
└────────────────────────────────────────────────────────────────────┘
```

- Column visibility toggles + bulk select per §3.2.

```mermaid
flowchart TB
    Dashboard["/dashboard"]
    Dashboard --> StoriesTab["Stories Tab"]
    Dashboard --> WorldsTab["Worlds Tab"]
    Dashboard --> EntitiesTab["Entities Tab"]
    StoriesTab --> CastNew["Cast New Story CTA"] --> CastingCircle["/casting-circle"]
    StoriesTab --> StoryTable["Compiled Story Table"]
    StoryTable --> PlayTest["Play/Test"]
    StoryTable --> ManagePublish["Manage/Publish Modal"]
    WorldsTab --> WorldCards["World Cards"]
    WorldCards --> WorldEditor["World Editor Tabs"]
    EntitiesTab --> EntityCards["Entity Cards"]
    EntityCards --> EntityEditor["Entity Editor Tabs"]
```

### Worlds / Entities Cards

```
┌───────────────┐
│ World Title   │ Status badge
│ Biome, Rules  │ Last Edited
│ CTA: Edit →   │ Locked? show banner
└───────────────┘
```

Editors inside cards follow tabbed layout (Details | Configuration | Lore for worlds, Identity | Personality | Background for entities). The same modal overlay is invoked when jumping in from Casting Circle or any resource modal when the user owns the content, so edits never yank people out of their flow.

```mermaid
flowchart LR
    subgraph WorldEditor["World Editor"]
        WDetails["Details"]
        WConfig["Configuration"]
        WLore["Lore"]
    end
    subgraph EntityEditor["Entity Editor"]
        EIdentity["Identity & Stats"]
        EPersonality["Personality"]
        EBackground["Background"]
    end
    WorldCards --> WorldEditor
    EntityCards --> EntityEditor
    WorldEditor -->|Locked?| NewVersion["Create New Version"]
    EntityEditor -->|Locked?| CloneDraft["Clone to Draft"]
```

---

## 5. Casting Circle Wizard (`/casting-circle`)

```
┌─────────────────────────────────────────────┐
│ World | Forces | Elements | Bind            │
│ (✓)     (lock)   (lock)     (lock)          │
└─────────────────────────────────────────────┘

[Tab Panel]
World List (radio)
  ○ Emberwild
  ● Sunspire (selected)
Validation summary / CTA "Continue"

Bind Step:
┌ Compile Log ────────────────────────────────┐
│ ✓ World validated                           │
│ ⚠ Missing lore entry                        │
│ ...                                         │
└────────────────────────────────────────────┘
[Compile Story] button (disabled until no blocking errors)
```

- Mirrors flow described in §4 with autosave + error summary.

```mermaid
flowchart LR
    Start --> SelectWorld["Step 1: Select World"]
    SelectWorld --> VerifyForces["Step 2: Verify Forces"]
    VerifyForces --> SelectElements["Step 3: Select Elements"]
    SelectElements --> Bind["Step 4: Bind (Compile)"]
    Bind --> CompileCall["POST /chimera/compile"]
    CompileCall --> Success["CompiledStory Draft"]
    CompileCall --> Errors["Compiler Errors"]
    Errors -->|Deep link| FixWorld["World Editor"]
    Errors --> FixEntity["Entity Editor"]
    Success --> StoriesTab
    subgraph Autosave["Autosave"]
        SelectWorld
        VerifyForces
        SelectElements
    end
```

---

## 6. Manage/Publish Modal

```
┌────────────────────────────────────────────┐
│ Draft → Pending                            │
│ Title / Version / Status                   │
│--------------------------------------------│
│ Justification [multiline input 0/240]      │
│ [ ] I certify guidelines                   │
│                                            │
│ Cancel                 Publish to Public ▶ │
└────────────────────────────────────────────┘
```

- Pending state swaps CTA for “Cancel Request”; Published adds “Unpublish” + “Create New Version” button per §5.2.

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Pending: Publish (Justification + Agreement)
    Pending --> Draft: Cancel Request
    Pending --> Published: Admin Approves
    Published --> Draft: Unpublish
    Published --> Draft: Create New Version (clone)
    Draft --> Rejected: Admin Rejects (reason)
    Rejected --> Draft: Address Feedback
```

---

## 7. Cross-Linking & Usage

- Use this doc during standups/handoff for quick visual refresher.
- For behavior, edge cases, and statuses always refer back to `06_UX_Feature_Specs.md` (kept as the canonical requirements list).

---

## 8. Profile & Author Surfaces

### 8.1 Profile Hub

```
┌────────── Profile ──────────┐
│ Avatar  Display Name [Edit] │
│ Email / Auth details        │
│ Account Tier / Subscription │
│ Buttons: Manage Billing,    │
│ Security, Notification prefs│
└─────────────────────────────┘
```

- Tabs: `Account`, `Security`, `Notifications`.
- Quick links to `My Stories`, `My Creations`, Purchases history.

```mermaid
flowchart LR
    ProfileHub --> AccountSettings
    ProfileHub --> Security
    ProfileHub --> Notifications
    ProfileHub --> BillingPortal
    BillingPortal --> ConversionFlows
```

### 8.2 Author Profile Pages

```
Author Header
 Name / Portrait / Bio / Follow Button
 Stats: Published Stories, Worlds, Entities

Tabs:
  Stories | Worlds | Entities | Activity
```

- When viewing authorship links from resource modals, route here.
- Each tab reuses card grids scoped to that author.

```mermaid
flowchart LR
    AuthorPage --> AuthorStories --> StoryCard
    AuthorPage --> AuthorWorlds --> WorldCard
    AuthorPage --> AuthorEntities --> NPCCard
    AuthorPage --> FollowAuthor
    AuthorPage --> MessageOption["Report / Contact"]
```

### 8.3 Conversion & Store Flows

```
┌────────── Stones / Subscription ──────────┐
│ Balance summary                           │
│ [Buy Stones]  [Upgrade Plan]              │
│ Packs grid (Small, Medium, Large)         │
│ Subscription tiers comparison             │
│ Payment method / billing history          │
└───────────────────────────────────────────┘
```

- Accessible via Profile hub and marketing CTAs.
- Supports promo codes, receipt download, gifting stones.

```mermaid
flowchart LR
    ConversionEntry["Buy / Subscribe CTA"] --> Pricing["Select Pack/Tier"]
    Pricing --> Checkout["Payment Form"]
    Checkout --> Confirmation["Success Screen"]
    Confirmation --> BalanceUpdate["Update Balance / Entitlements"]
```

### 8.4 Other Potential Gaps

- **Notifications Center:** To surface approvals, compilation errors, subscription changes.
- **Admin Review Console:** Not yet designed; needed for approving Pending submissions.
- **Tutorial / Onboarding Flow:** Walk new authors through first world/story creation.
- **Searchable Lore Library:** Standalone view for authors to manage large lore sets.
- **Support / Help Center:** Quick link for reporting issues outside Manage modal.
