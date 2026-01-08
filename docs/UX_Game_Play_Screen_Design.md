# Game Play Interface Specification (v1.2)

**Status:** Approved for Implementation
**Context:** This specification maps the JSON structure returned by `POST /api/games/:id` (Full State) and `POST /turn` (Delta) to the specific UI components in the 3-Column "Holy Grail" Layout. It accounts for both "Full Entity" NPCs (complex structure) and "Genesis Spawn" Extras (simple structure).

---

## **I. Global Layout: "The Holy Grail"**

A responsive 3-column grid with a fixed header and footer.

* **Container:** `h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground`
* **A. Header (Top Bar):** Fixed height (`h-14`), full width.
    * **Z-Index:** 20 (Above Columns).
* **B. Stage (Flex Row):**
    * **1. Left Column ("The Self"):**
        * **Width:** `w-20` (Slim/Tablet) → `w-72` (Full/Desktop).
        * **Transition:** `transition-all duration-300`.
        * **Visibility:** Hidden on Mobile (`hidden md:flex`).
    * **2. Center Column ("The Narrative"):**
        * **Width:** Fluid (`flex-1`), enforces `min-w-[320px]`.
        * **Scroll:** Independent scrolling container for the Game Log.
    * **3. Right Column ("The World"):**
        * **Width:** `w-20` (Slim/Laptop) → `w-80` (Full/Desktop).
        * **Transition:** `transition-all duration-300`.
        * **Visibility:** Hidden on Tablet (`hidden lg:flex`).

---

## **II. Component Detail & State Bindings**

### **A. Game Header (`GameHeader.tsx`)**
* **Purpose:** Scene Context & Global Controls.
* **State Source:** `state.narrative_focus.scene_context` (Confirmed JSON path).
* **Elements:**
    1.  **Exit:** `<LogOut />` (Left).
    2.  **Scene Context (Center):**
        * **Location Name (H2):** `scene_context.name` (e.g., "Testing story 1").
        * **Meta Line (Span):** `scene_context.time` + `scene_context.atmosphere` (e.g., "Night - Lighthearted").
        * **Correction:** Use `scene_context` specifically, do not rely on `tier1_world` for this display text to ensure narrative consistency.
    3.  **Config:** `<Settings />` (Right).

### **B. Left Column: "The Self" (`LeftSidebar.tsx`)**
* **Purpose:** Player Vitals & Identity.
* **State Source:** `mechanical_state.entities[index.player_id]`.
* **Responsive Modes:**
    * **Full (XL+):** Avatar + Name + Bars + Badges.
    * **Slim (MD-LG):** Avatar + Icon-Only Bars.

#### **1. Player Identity**
* **Data:**
    * **Name:** `properties.name` ("Daakon").
    * **Role:** `properties.occupation_tags[0]` ("Versatile Guardian").
* **Visual:**
    * **Avatar:** Circle with Initials (`name[0]`).
    * **Interaction:** `onClick` → Opens `CharacterSheetModal`.

#### **2. Vitals Panel**
* **Data Source:** `properties`
* **Stamina:**
    * **Value:** `current_stamina` (0-100).
    * **Logic:** Green (>70), Yellow (>30), Red (<30).
    * **Slim Mode:** Show only the `Zap` icon. Pulse red if < 30.
* **Satiety:**
    * **Value:** `satiety` (0-100).
    * **Slim Mode:** Show only `Utensils` icon.

#### **3. Status Grid**
* **Logic:** Filter out "neutral" states.
    * Show badge if `physical_condition` != "Rested".
    * Show badge if `hunger_state` == "Starving".

### **C. Right Column: "The World" (`HudSidebar.tsx`)**
* **Purpose:** Environment & NPC List.
* **State Source:** `scene_registry` + `mechanical_state.entities`.
* **Responsive Modes:**
    * **Full (XL+):** Clock Card + List of Avatar/Name/Role cards.
    * **Slim (LG-XL):** Icon Clock + Vertical stack of Avatar circles.

#### **1. World Clock (`WorldClock`)**
* **Source:** `narrative_focus.scene_context.time` (e.g., "Night").
* **Display:**
    * **Full:** Icon + Text "Night".
    * **Slim:** Icon only (Moon).

#### **2. Nearby Cast (`NearbyCast`)**
* **Filtering Logic:**
    1.  Get Player Node: `registry.entity_locations[player_id]`.
    2.  Filter `entity_locations`: Find IDs matching Player Node.
    3.  Exclude Player ID.
* **Data Mapping (Hybrid Support):**
    * **Full Entity (e.g., Cael):**
        * **Name:** `raw_data.identity.name` or `display_name`.
        * **Role:** `raw_data.identity.species` or `tags` (e.g., "Dire Wolf Shifter").
        * **Avatar:** Initials.
    * **Genesis Spawn (e.g., Bartender):**
        * **Name:** `properties.name`.
        * **Role:** `properties.archetype` (e.g., "Bartender and Tavern Owner").
        * **Avatar:** Initials.
* **Interaction:** `onClick` → Opens `EntityInspectorModal`.

### **D. Center Column: "The Stage"**

#### **1. Game Log (`GameLog`)**
* **Source:** `store.turns` array.
* **Items:**
    * **User Bubble:** `turn.player_input`.
    * **Narrative Bubble:** `turn.mas2_narration.narration`.
* **Constraints:** Text must wrap. Images/Markdown supported.

#### **2. Input Area (`GameInput`)**
* **Position:** Sticky footer of Center Column.
* **Behavior:** Auto-growing textarea.

---

## **III. Modal Layer**

#### **1. Entity Inspector (`EntityInspectorModal`)**
* **Trigger:** Sidebar Clicks.
* **Hybrid Data Handling:**
    * **Header:** `name` / `display_name`.
    * **Subheader:** `archetype` OR `identity.species`.
    * **Description:** `properties.description` (Extras) OR `raw_data.description` (Full).
    * **Tags:** `properties.tags` OR `raw_data.traits`.
    * **Stats:** `properties.combat_prowess` OR `raw_data.tier1_entity.combat_prowess` (Future proofing).

---

## **IV. Implementation Plan (Phased)**

1.  **Phase 1: Game State UX Refactor (Current Priority)**
    * Implement "Holy Grail" Layout.
    * Apply Responsive "Slim" Sidebars.
    * Bind Header to `scene_context`.
    * Bind Sidebars to `mechanical_state`.

2.  **Phase 2: Entity Data Normalization (Next Phase)**
    * Refactor "Genesis Spawn" data structure to match "Full Entity" structure more closely to simplify frontend mapping.
    * Update `GameInitService` to generate standard entity shapes.