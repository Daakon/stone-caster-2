# 📜 SPI Frontend Behavior Specification
**Version:** 1.0
**Target:** Frontend Architecture & UI/UX Implementation
**Scope:** Interaction Rules, Responsive Logic, and Feedback Loops

---

## 1. Input Protocol: "Draft & Commit"
**Philosophy:** Prevent accidental high-stakes actions. Suggestion chips serve as *accelerators*, not *triggers*.

### Interaction Logic
| Input Source | Action | State Result | UX Behavior |
| :--- | :--- | :--- | :--- |
| **Suggestion Chip** | **Single Click** | `Drafting` | Populates Input Field with text. Focus moves to Input. Player can edit. |
| **Suggestion Chip** | **Double Click** | `Execute` | (Desktop Only) Commits input immediately. |
| **Manual Typing** | **Enter / Send** | `Commit` | Locks Input Field. Triggers `Thinking` state. |
| **Input Field** | **During Processing** | `Locked` | Field dims. "Rune/Quill" loading animation appears. **No Cancellation allowed.** |

---

## 2. The Sensory FX Matrix (Feedback Loops)
**Philosophy:** Visceral feedback must render simultaneously with text processing, driven by `StateDelta` packets.

### FX Tiers
| Tier | Trigger Condition (Engine) | Visual FX (Client) | Audio FX |
| :--- | :--- | :--- | :--- |
| **1. Vital** | HP/Stamina drops > 25% in one turn | **Screen Shake** (mild). Red Vignette pulse on edges. | Heavy "Thud" or Heartbeat. |
| **2. Status** | Effect applied (Stun/Freeze/Poison) | **Color Grading:** Desaturate (Gray) or Tint (Cyan/Green). | High-pitched ringing or specific element sound. |
| **3. Victory** | Level Up / Quest Complete | **Particles:** Gold glow emits from Avatar HUD. | "Shimmer" / Chord swell. |
| **4. Danger** | Stealth Failed / Trap Triggered | **UI Alert:** "Eye" icon snaps open & pulses red. | Sharp violin screech or "Snap". |

---

## 3. Inspector Interaction: "Peek vs. Dive"
**Philosophy:** Access to information should not break flow unless requested.

### Interaction States
* **The Peek (Tooltip/Popover):**
    * **Trigger:** Hover (Desktop) or Long-Press (Mobile) on `EntityLink`.
    * **Content:** Name, Relation (Friend/Foe), HP Estimate (Words, not numbers).
    * **Behavior:** Non-blocking overlay.
* **The Dive (Inspector Panel):**
    * **Trigger:** Click/Tap on `EntityLink`.
    * **Desktop Behavior:** Populates Right Pane. Game flow persists.
    * **Mobile Behavior:** Opens `SlideOverDrawer` (85% height). Pauses/Dims background stream.

---

## 4. Adaptive HUD: "The Lens of Relevance"
**Philosophy:** UI elements are "Passive" by default and "Critical" only when thresholds are crossed.

### Dynamic Docking Logic
* **State A: Passive (Exploration)**
    * **Mobile:** Vitals are condensed icons in the Sticky Header. No numbers.
    * **Desktop:** Minimal bars in the Side Pane.
* **State B: Critical (Combat / Low HP)**
    * **Trigger:** `in_combat == true` OR `hp < 30%`.
    * **Behavior:** The Vital Bar **undocks** from its passive container.
    * **Mobile Result:** Floats as an overlay bar at the **Bottom Center** (above Input Deck).
    * **Desktop Result:** Bar expands, color intensifies, numerical values appear.

---

## 5. Mobile Ergonomics & "The Thumb Zone"
**Philosophy:** Bottom-weighted design to accommodate device handling.

* **Zone Layout:** Input Field, Suggestions, and Primary Menu must exist in the bottom 30% of the viewport.
* **Virtual Keyboard Defense:**
    * **Event:** `Focus` on Input Field.
    * **Reaction:** `NarrativeStream` auto-scrolls to bottom anchor.
    * **Reaction:** Suggestion Chips hide to reclaim vertical space.
    * **Reaction:** Sticky Header remains fixed to preserve Time/Location context.

---

## 6. Narrative Transparency: "History of Intent"
**Philosophy:** Build trust in the deterministic engine by visualizing the mechanics.

* **Rendering Rule:** Between the *Player Input* and *AI Result*, the UI must render a distinct **System Line**.
* **Format:**
    > **Player:** "I swing my sword!"
    > *[System: Strength Check (Roll: 12) vs AC (14) -> FAILURE]*
    > **Game:** Your blade glances off his shield...
* **Styling:** Monospace font, smaller size, muted color (distinct from narrative prose).