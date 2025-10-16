# StoneCaster — Chat System MVP PRD (Chat Feature Only)

> **Purpose**: Define product-level requirements and acceptance criteria for the chat-driven RPG experience (website + AI behavior). No code specs; behavior and outputs only. 

---

## 1) Product Goals & Principles
- **Chat = Game**: The chat interface *is* the RPG session. All key actions (explore, converse, fight, rest, craft) are driven via message exchange.
- **Player Agency First**: The AI never chooses actions for the player. It frames situations, consequences, and options.
- **World-Aware**: Sessions respect world lore, tone, mechanics, NPC agency, calendars, and locations.
- **Long-Term Progression**: Characters and NPCs develop over time across sessions with persistent state and memorable moments.
- **Safe & Configurable**: Player-selectable tone/content boundaries are respected at all times.
- **Cost-Aware**: Keep interactions fast and affordable without sacrificing immersion.

---

## 2) Scope (MVP)
**In**
- Single-player chat sessions bound to a selected world + one player character (PC)
- World layer (lore, tone presets, content boundaries defaults) over a genreless base PC template
- Session structure: scenes → turns → AI offers contextual choices → player decides → outcomes
- RPG mechanics: skill checks and chance outcomes; NPC agency
- AI-generated choice sets tailored to situation, PC traits, and player’s content settings
- Temporal state: time of day, time advancement inferred from actions and explicit player statements
- Persistent memory of important moments and relationship beats
- Save/Resume session; recap recent key moments on return
- Tone & content controls (violence, romance/sexual content, psychological intensity, language tone)
- **Energy & Recovery** for PCs and NPCs influencing success chances
- Basic guardrails and safety filters

**Out** (Not in MVP)
- Co-op/multiplayer party chat
- Visual map UI or battle grid
- Complex inventory UI (basic textual inventory only)
- Homebrew rule editors
- Mod marketplaces
- **Undo/Reverse/Edit AI output** (post-MVP consideration)

---

## 3) Key Personas
### **Primary Personas (Players)**
1. **Story Explorer**  
   - Motivated by immersion and worldbuilding.  
   - Prefers character-driven narratives, rich dialogue, and evolving lore.  
   - Low interest in mechanics; values tone consistency and emotional arcs.

2. **Tactician / RPG Traditionalist**  
   - Motivated by skill checks, consequences, and cause-effect gameplay.  
   - Wants clear rules and fairness in outcomes.  
   - Enjoys seeing stats and dice logic influence results.

3. **Creative Roleplayer**  
   - Motivated by improvisation and expressive freedom.  
   - Often types custom actions instead of selecting choices.  
   - Wants AI to adapt naturally to unusual player behavior.

4. **Casual / Narrative Consumer**  
   - Motivated by accessible storytelling and low-friction play.  
   - Uses preset characters and minimal configuration.  
   - Prefers shorter sessions with good pacing.

5. **World Jumper**  
   - Interested in exploring multiple genres and worlds (fantasy, sci-fi, horror, etc.).  
   - Values seeing how tone and mechanics shift between settings.  
   - May re-use a genreless base character across worlds.

### **Secondary Personas (Internal Roles)**
1. **World Author (Internal)**  
   - Curates lore, sample locations/NPCs/adventures, and default tone settings.  
   - Needs predictable AI adherence to world logic.

2. **Moderator / Safety Reviewer (Internal)**  
   - Ensures all AI outputs respect user tone settings and global safety rules.  
   - Monitors content thresholds and incident reports.

---

## 4) Core User Stories
1. **Start Session**: As a player, I can pick a world and a character (or create from a base template), then start a chat session that feels true to that world.
2. **Take Turns**: As a player, I see a short narrative beat and 3–5 contextually appropriate options (plus free-typing) without the AI taking actions for me.
3. **Skill Checks**: As a player, when an action is uncertain, the system runs a skill check (modified by energy and context) and describes outcomes fairly and clearly.
4. **NPC Agency**: As a player, NPCs behave consistently with their motives, relationships, and world rules—acting in scenes as they logically would, even without player prompting.
5. **Time & Memory**: As a player, the world tracks time of day and remembers important moments to influence future scenes.
6. **Tone Controls**: As a player, I can set content boundaries (violence, romance, psychological intensity, language) and the story respects them.
7. **Persistence**: As a player, I can leave and resume; the session opens with a helpful recap and continues smoothly.

---

## 5) Functional Requirements & Acceptance Criteria

### 5.1 Session Initialization
**Requirements**
- Player selects **World** and **PC**. PC can be created from a **genreless base template** plus **world overlay** (appearance/backstory hooks).
- World provides presets: tone, default content boundaries, sample locations/NPCs/adventures.

**Acceptance Criteria**
- Given a world and PC, starting a session produces a **world-authentic opening scene** within 2–4 paragraphs.
- Opening includes: current **time of day**, place context, and at least **3 AI-generated choices** reflecting PC traits and content settings.

### 5.2 Turn Loop & Choices
**Requirements**
- Each narrative beat ends with **3–5 choices** tuned to situation + PC sheet + recent moments.
- A **“type your own action”** input is always available.
- AI never takes actions on behalf of the player; it only narrates consequences once the player decides.

**Acceptance Criteria**
- Every AI message ends with choice list + a free-action hint.
- If a player enters a custom action, the AI interprets it and proceeds without assuming unrelated actions.

### 5.3 Skill Checks, Energy & Outcomes
**Requirements**
- When uncertainty exists, run a **skill/attribute check**.
- **Energy System** applies to both PCs and NPCs:
  - Actions **consume energy** (e.g., combat, sprinting, intense spellcasting, prolonged negotiation).
  - **Resting/eating/drinking** restores energy; recovery descriptions appear narratively.
  - **Low energy** imposes **penalties** on skill chances or increases difficulty thresholds.
  - AI must consider **NPC energy** for their effectiveness and choices (e.g., a tired guard is less alert).
- Outcomes include **success / partial / fail** bands, influenced by energy and situational modifiers.

**Acceptance Criteria**
- Risky actions show that a check occurred and clearly reflect **energy-modified** outcomes when relevant.
- The narrative occasionally surfaces energy status (e.g., "You feel winded" / "You’re refreshed after the meal").

### 5.4 NPC Agency, Location Tracking & Factions
**Requirements**
- NPCs maintain consistent **voice, motives, and boundaries**.
- In each scene, all present NPCs should **act or respond** according to their personality, goals, and relationship to the player.
- The system must **track the current location** and which NPCs are there.
- NPCs not in the current scene can still **progress their own goals, factions, and behind-the-scenes actions**, influencing future events and available dialogue.
- Adventures and story arcs include **multi-path progression**—players can complete steps in varied ways, but the world always moves forward.
- NPCs and factions **adapt dynamically** to player choices and story progression.

**Acceptance Criteria**
- NPCs present in a scene are referenced and act naturally within every major turn or beat.
- When the player returns to a location or character, dialogue and world state reflect recent developments.
- Faction and NPC background progressions occur even off-screen and manifest through later consequences or rumors.

### 5.5 Time of Day, Advancement & Turn Deltas
**Requirements**
- Session state tracks **time of day** and advances time based on actions (travel/rest/crafting/investigation/combat) and explicit statements (“camp overnight”).
- **Every AI response must include a one-line time delta** estimating how many **ticks/minutes** passed for the narrated actions. (Used by the webapp to update time-of-day.)
- Time affects **descriptions, encounter likelihoods, NPC availability**.

**Acceptance Criteria**
- The AI references current time context at least every **2–3 turns** or when it changes.
- Each AI message ends (or begins) with a succinct **Time Passed** line (e.g., "**Time Passed:** ~15 minutes / 1 tick").
- If the player performs a time-consuming action, subsequent scene adjusts time accordingly.

### 5.6 Memory of Important Moments
**Requirements**
- Tag and remember **key beats**: major choices, discoveries, relationship changes, named locations, vows, failures.
- Use these to generate **recaps** and inform future choice sets.

**Acceptance Criteria**
- On resume, show a 3–6 bullet **recap** of last session’s key moments.
- Within-session callbacks (e.g., “Because you spared the bandit earlier…”) appear within **3 turns** of relevance.

### 5.7 Tone & Content Controls
**Requirements**
- Player-adjustable controls with clear labels:
  - Violence (None / Mild / Gritty / Brutal)
  - Romance & Sexual Content (None / Fade-to-Black / Mature)
  - Psychological Intensity (Light / Moderate / Dark)
  - Language (Clean / Natural / Mature)
- World/adventure presets define defaults; players can override at any time.

**Acceptance Criteria**
- Changes take effect on the **next AI message**.
- AI output never crosses the selected thresholds; violations are treated as P0 bugs.

### 5.8 Save/Resume & Recap
**Requirements**
- **Automatic save only** at the end of each AI turn.
- Manual **Save & Exit** option (explicit exit, same auto-save mechanics).
- On resume, present a **recap** + current time/location/context in ≤ 120 words.
- **Note:** A potential future feature is **undo/reverse/edit AI output**, but it is **post-MVP** pending design/testing.

**Acceptance Criteria**
- Exiting mid-scene and resuming restores the same scene with consistent state.
- Recap references at least **2** important moments from the prior session.

### 5.9 Content Safety & Guardrails
**Requirements**
- Enforce player content settings + global safety policies.
- Provide a **content boundary crossed** soft-warning flow and safe reformulation.

**Acceptance Criteria**
- If a requested scene exceeds limits, AI offers a **boundary-respecting alternative** and explains briefly why.

### 5.10 Performance & Cost Expectations
**Requirements**
- Target **response time**: ≤ 4s p50, ≤ 8s p95 for average-length turns.
- Target **token budget**: concise narration (200–450 words), trimmed context, recent-moment highlights.

**Acceptance Criteria**
- 90% of turns meet speed targets in staging.
- Narratives remain vivid without unnecessary verbosity.

---

## 6) Non-Functional Requirements
- **Reliability**: No loss of save state; recover gracefully from transient errors with a one-line apology and resume.
- **Consistency**: World tone and rules remain stable across turns.
- **Accessibility**: Clear choice formatting; keyboard-only navigation; readable contrast.

---

## 7) UX Guidelines (Chat Only)
- AI messages segmented into:
  1) **Narrative paragraph(s)** (2–4 short paragraphs)
  2) **Mechanics callouts** (checks, energy impact, consequences) in a brief single line when relevant
  3) **Choices (3–5)**, each starting with an action verb
  4) A **free-action hint** (“Or type your own action…”) 
  5) **Time Passed** line (ticks/minutes)
- **Recap card** on resume with time-of-day badge.
- **Content Controls** accessible via a chat-side panel; changes confirm with a one-line toast.
- **Energy prompts** appear contextually (e.g., suggest rest or food when low).

---

## 8) Success Metrics (MVP)
- ≥ 60% of new players complete a first session of ≥ 10 turns.
- ≥ 40% of returning players resume within 72 hours.
- < 2% of turns trigger content-boundary violations.
- p95 latency ≤ 8s across 1000 sessions test.

---

## 9) QA Test Matrix (Acceptance Examples)
- **Tone adherence** across worlds at each boundary level.
- **NPC consistency** after relationship change and scene re-entry.
- **Faction and behind-the-scenes events** progressing logically.
- **Energy effects** on skill outcomes; recovery after rest/eat.
- **Time progression** and **Time Passed** line present each turn; day/night shifts occur correctly.
- **Skill checks** produce distinct narratives for success/partial/fail.
- **Recap quality** references correct prior moments.

---

## 10) Open Questions
- Do worlds define **custom calendars** (moons, festivals) in MVP or post-MVP?
- Do we expose **die-roll values** explicitly or narratively only?
- Should players **bookmark** favorite NPCs/locations for quicker callbacks?
- How granular should **faction-level simulation** be in MVP? *(Will be determined via testing.)*
- What is the minimal **energy model** (range/units) that delivers clarity without UI bloat?

---

## 11) Definition of Done (MVP)
- All acceptance criteria in §5 met in staging.
- QA matrix scenarios pass at ≥ 95%.
- Safety review completed for tone/content controls.
- Docs: Player help page + internal runbook for world authors.

