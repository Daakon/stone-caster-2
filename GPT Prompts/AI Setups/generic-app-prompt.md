Build a Universal, World-Agnostic RPG Storytelling Platform

You are a senior full-stack developer. Design and scaffold a modular web application for interactive RPG storytelling across multiple worlds and adventures. The system should support:

Modular, pluggable worlds and adventures (runtime loaded).

Persistent character creation and story saves.

Optional premium content monetization via subscriptions and purchases.

Support for streamed AI-driven storytelling with moderation and safeguards.

Web- and mobile-friendly interactive narrative UI with accessible controls.

✅ Core Product Features
🗺️ World & Adventure System

Loadable content bundles representing a world, lore, style, and adventures.

Users can explore, preview, and install both free and paid bundles.

Each bundle includes metadata, assets, narrative logic, and validation layers.

🎭 Characters & Game Progress

Create multiple characters per adventure.

Save and resume story sessions with recap.

Auto-save and manual save/export features.

💸 Monetization

Tiered subscriptions, one-time purchases, and trials.

User entitlements synced through webhook events (e.g., from a payment provider).

Paywall gating for premium adventures or features.

🔄 A/B Testing and Model Routing

Sessions can dynamically use different LLM providers or variants.

Track which model was used per session and its performance.

🔐 Safety & Moderation

Moderate both user input and AI output.

Gated image generation, enabled only if scene metadata marks it safe.

Centralized policy definitions (e.g., age rating, content types).

🔧 Technical Scope (Customizable per Stack)

Suggest and build based on any modern stack, but your architecture must support:

Modular content loading (support versioned content bundles).

A real-time turn engine for AI narration and user interaction.

Persistent user storage (accounts, characters, saves, content ownership).

Integrated payment and entitlement system.

Scalable hosting & streaming (mobile-first optimized UI).

📦 Content Bundle Loader

Define a structured system for ingesting “world” and “adventure” bundles, which may include:

Game logic

Narrative templates

UI flavor packs

Validation schemas

Lore documents

Support versioning, partial loading with graceful degradation, and a registry of available bundles.

🌐 Frontend Experience

Design a mobile-first UI/UX for the story engine and platform:

Discover → Acquire → Create → Play → Save/Resume

Display location/time/weather headers per scene

Numbered, keyboard-accessible choices

Toggled mechanics or narrative-focused display

Recap shown after save load

🧠 Engine Runtime Constraints

These apply to all worlds and stories:

No character name reveal until player shares it.

Always show location/time/weather.

No ambient narration during outcome or choice moments.

Always number choices.

Recap required on load.

Continue rendering with fallbacks when templates are missing (degrade gracefully).

🧪 Validation & Testing

Include:

Automated tests (unit + E2E) validating core flows.

Narrative engine self-tests: validate headers, names, outcomes, choices, etc.

Payment tests for tier unlocks and entitlements.

Migration logic for save files when bundles update.

📊 Observability & Admin Tools

Implement observability hooks:

Track moderation events, model choice, AI token use, user decisions.

Admin panel to manage content bundles, run validations, toggle flags.

🛠️ Deliverables

You should generate:

Project scaffold (codebase)

Basic content examples (e.g., one “High Fantasy” and one “Sci-Fi” world)

README with setup and deployment instructions

Database schema with relationships and indexes

Payment integration (demo/test keys and products)

Bundle loader logic and validation structure

Turn-by-turn AI streaming and response handling

Admin UI with bundle activation, moderation logs, and session tests
