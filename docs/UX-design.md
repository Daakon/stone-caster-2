# StoneCaster UX Wireframe Specification (Product Guidance Version with Invite-Only Access)

This document is the **wireframe blueprint and product direction** for StoneCaster. It defines all player-facing, legal, and admin screens in a unified flow, including integration of the **Dimensional Drifter** as an in-world tutorial guide. Branding emphasizes **Casting Stones** as the core metaphor. Selling points such as **relationships, factions, NPC agency, world-specific rules, tagging, account-based limits, and invite-only access** are woven throughout the experience to differentiate StoneCaster from competitors.

---

## Branding & Differentiation

* **Casting Stones**: Stones are the currency of storytelling power. Every action, turn, or decision consumes a stone. This must be visually reinforced in all parts of the UI.
* **Dimensional Drifter**: Appears primarily in tutorial and onboarding contexts, acting as an in-world narrator and guide. Should be dismissible after initial flows.
* **Key Differentiators**:

  * **Relationships**: NPCs adapt dynamically as you earn trust or betrayal.
  * **Factions**: Balance shifts in reaction to player actions, even if not always visible.
  * **NPC Agency**: Characters act with their own goals and persistence beyond player influence.
  * **World-Specific Rules**: Each world introduces unique mechanics or laws of play.
  * **Account-Based Limits**: Active games and characters scale by account tier (Guest, Free, Premium).
  * **Invite-Only Access (Early Stage)**: Initial access is gated to invited users only.
* **Tagging System**: Worlds, adventures, and scenarios all carry tags. Browsers and detail screens should allow filtering and searching across them.

---

## 1. Landing Page (`/`)

* Purpose: Introduce the product and differentiate it from other AI-driven RPGs.
* Content: Tagline (*“Cast stones to shape living worlds.”*), preview carousel of adventures/worlds, and highlights of relationships, factions, NPC agency, world rules.
* Access Notice: Prominent banner or card stating **“Currently Invite-Only Access”** with optional email input or referral link entry.
* Drifter appears with introductory guidance: *“This gateway is open only to invited travelers — for now.”*
* Footer contains ToS, Privacy, Disclaimer, FAQ, About.

---

## 2. Adventure Browser (`/adventures`)

* Purpose: Primary funnel into the game.
* Content: Search, filters, and tags for worlds, adventures, and scenarios.
* Card interaction: Opens a modal with summary, stone cost, short description, and options to **View Details** or **Learn About World**.
* CTA Handling: **Start Adventure** is **gated** — if the user is not invited, the button is disabled with tooltip or modal: *“This journey requires an invitation at this stage.”*
* Drifter messaging explains: *“Only chosen travelers may cast stones here during this stage.”*

---

## 3. Adventure Detail (`/adventures/:id`)

* Purpose: Deeper look at an adventure.
* Content: Cover art, description, quest preview, world rules panel, tags, and differentiators.
* CTA Handling: **Begin Adventure** gated to invited users only. Non-invited accounts see upsell: *“Adventure access is invite-only during early access.”*
* Link: **View World Details** remains available.
* Drifter guidance: *“When your invitation arrives, this path will open to you.”*

---

## 4. World Browser (`/worlds`)

* Purpose: Exploratory view to learn about all worlds.
* Content: Grid of world cards with search and filtering.
* Cards link to world detail pages; all content viewable without invite.
* Drifter frames worlds as lore-rich foundations, accessible to explore but gated for play.

---

## 5. World Detail (`/worlds/:id`)

* Purpose: Provide deep context for a single world.
* Content: Cover, description, world rules, differentiators, simplified list of related adventures.
* Adventures listed with cards, but CTAs for **Start Adventure** gated by invite status.
* Link to **View Adventure Details** remains available.
* Drifter Bubble: *“The world reveals itself freely, but only the invited may step inside.”*

---

## 6. Character Selection / Creation (`/adventures/:id/characters`)

* Access Control: Only accessible if invited.
* Non-invited accounts redirected to invite notice page or upsell modal.
* Otherwise, functions as previously detailed (shared + world-specific steps).

---

## 7. Game Screen (`/game/:id`)

* Access Control: Only invited users may enter. Non-invited attempts rerouted to invite notice.
* Otherwise, functions as core gameplay view with stones, turn input, history, and world-specific rule trackers.

---

## 8–14. Wallet, Payments, Upgrade, Profile, Legal, Admin, Global Elements

* As previously detailed, unchanged in structure.
* Wallet, profile, and payments may remain accessible for non-invited users to preview account tier options.

---

## 15. Unified Funnel (World → Adventure → Character → Game)

* All funnels converge on the same loop, but access is gated until invite verification passes.
* Invite-gating must be consistent whether entry is from adventures, adventure detail, or world detail.

---

## Product Acceptance Criteria

* ✅ Landing page clearly communicates invite-only status while still showcasing product differentiators.
* ✅ Adventures and worlds remain explorable for non-invited users but gated at actual **Start Adventure**.
* ✅ Drifter narratively explains the invite-only stage in-world.
* ✅ Invite-only logic applied consistently across all funnels.
* ✅ Once invited, flow proceeds seamlessly through adventure → character → game loop.
