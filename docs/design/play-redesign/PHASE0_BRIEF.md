# Phase 0 brief: tokens and mobile-first play shell

Status: ready to start after F0a is merged to main. This brief is for any coding agent (Codex, Cursor, Copilot, Claude, etc.). It narrows `ROADMAP.md` Phase 0 and `PLAN.md` "Phase 0" into tasks you can check off. If this brief, `SPEC.md` (including §11) and `PLAN.md` disagree, stop and report the conflict.

Read first, in order:
1. `SPEC.md` §1–§3 and **§11** (design review decisions)
2. `docs/design/style-guide/STYLE_GUIDE.md` and `COMPONENTS.md`
3. Screens: `docs/design/screens/Play-Mobile.png`, `Play-Mobile-Focus.png`, `Play-Mobile-Character.png`, `Play-Mobile-Here.png`, `Play.png`, `Play--slim-rails.png`, `Play-Focus.png`
4. `PLAN.md` "Phase 0" (backend state initialization and play view)

Work in three independent slices. Each is its own branch and PR (see `.cursor/rules/95-atomic-commits.mdc` and `97-mainline-integration.mdc`).

---

## 0A. Tokens in code (frontend only, no dependencies)

1. Copy the custom properties from `docs/design/play-redesign/tokens.css` into `frontend/src/index.css` (`--sc-*` names unchanged).
2. Replace the shadcn HSL variables with this mapping. Note that shadcn's `accent` is a hover surface, not teal; teal stays `--sc-accent`.

```css
:root {            /* light */
  --background: 257 54% 97%;  --foreground: 253 30% 12%;
  --card: 0 0% 100%;          --card-foreground: 253 30% 12%;
  --popover: 257 50% 93%;     --popover-foreground: 253 30% 12%;
  --primary: 253 63% 57%;     --primary-foreground: 0 0% 100%;
  --secondary: 257 50% 93%;   --secondary-foreground: 253 30% 12%;
  --muted: 256 44% 95%;       --muted-foreground: 252 16% 41%;
  --accent: 257 50% 93%;      --accent-foreground: 253 30% 12%;
  --destructive: 0 58% 49%;   --destructive-foreground: 0 0% 100%;
  --border: 258 32% 88%;      --input: 255 28% 76%;   --ring: 253 63% 57%;
  --radius: 0.625rem;
}
.dark {
  --background: 247 31% 6%;   --foreground: 257 44% 94%;
  --card: 251 28% 12%;        --card-foreground: 257 44% 94%;
  --popover: 251 28% 16%;     --popover-foreground: 257 44% 94%;
  --primary: 255 92% 76%;     --primary-foreground: 254 57% 9%;
  --secondary: 251 28% 16%;   --secondary-foreground: 257 44% 94%;
  --muted: 250 27% 9%;        --muted-foreground: 252 15% 60%;
  --accent: 251 28% 16%;      --accent-foreground: 257 44% 94%;
  --destructive: 0 82% 65%;   --destructive-foreground: 254 57% 9%;
  --border: 252 25% 20%;      --input: 251 24% 27%;   --ring: 255 92% 76%;
}
```

3. In `frontend/tailwind.config.js`, add `sc` colours that read the variables (`sc: { page: 'var(--sc-bg-page)', panel: ..., card: ..., raised: ..., primary: ..., accent: ..., ... }`), `fontFamily.display/prose/ui/mono` from the `--sc-font-*` stacks, and the radius/spacing tokens. Remove or remap the unused `stone` and `magic` palettes.
4. Load Fraunces, Newsreader, DM Sans and JetBrains Mono (Google Fonts `<link>` in `frontend/index.html`, or self-host in `frontend/public/fonts/` if licensing is approved). Keep the fallback stacks.
5. Make dark the default theme for the app. Light must stay legible.
6. Run `node scripts/check-design-tokens.mjs`. It must pass with no new violations.

**Accept:** `npm run type-check:client`, `npm run lint:client` and `npm run test:client` pass. The existing play screen still works (only its colours change). Nothing in `frontend/src/features/play` contains a raw hex value.

---

## 0B. Mobile-first shell against fixtures (frontend only)

Build against a deterministic play-view fixture. Do not wait for the backend.

1. Create `frontend/src/features/play/model/play-view.ts`, the typed view model the shell renders. Base it on the planned `shared/src/types/chimera-play-view.ts` from PLAN Phase 0. Add fixtures for three rule mixes (Chimera core, social-only, combat), using the fields in SPEC §11.3. A module the fixture doesn't declare is absent. No default 100s. No Health unless declared.
2. Add layout state to `frontend/src/stores/useActiveGameStore.ts`: `layout: { left: 'open'|'slim'|'hidden', right: 'open'|'slim'|'hidden', focus: boolean, modules: Record<moduleId, 'always'|'on_change'|'never'> }`, with actions to toggle each side, enter/exit focus (restoring the prior state) and hide a module.
3. Rebuild `frontend/src/features/play/layout/ThreeColumnLayout.tsx` **mobile first**:
   - < 768px: header (back, place and time, Journal) + vitals strip (opens the Character sheet) + cast stack (opens the Here sheet) + feed + thumb-zone composer. Sheets can be simple shadcn `sheet`s with placeholder content in Phase 0.
   - ≥ 768px: top bar with panel toggles, Focus and Layout buttons; left and right panels driven by layout state (288/64/0 and 328/64/0), with the story column centred at `--sc-measure`.
4. Build these components in `frontend/src/features/play/components/` (feature components, not `components/ui`), each rendering only fields present in the view model:
   - `HUD/ModuleCard` (header with a hide button)
   - `HUD/Vital` (number and bar, delta chip)
   - `HUD/Pillar`
   - `HUD/ConditionPill`
   - `HUD/SlimRail`
   - `HUD/HereRail` (scene card and cast cards)
   - `HUD/MobileVitalsStrip`
   - `HUD/CastStack`
   - `HUD/PopInCard` (On change modules)

   Use `COMPONENTS.md` for visual specs, and shadcn primitives (`button`, `sheet`, `tooltip`, `progress`, `toggle-group` if present) underneath.
5. Update `GameHeader.tsx`: never show "Unknown" or raw ids. Hide fields the view model doesn't have.
6. Add the components and the three fixtures to `frontend/src/pages/_test_gallery.tsx` so reviewers can see every module state.
7. Tests:
   - `frontend/src/features/play/__tests__/phase0-shell.test.tsx`: absent modules are not rendered, toggles cycle open/slim/hidden, focus restores, no Health without a declared field, icon-only buttons have accessible names.
   - `frontend/e2e/play-redesign-phase0.spec.ts`: screenshots at 390x844, 1100x800 and 1440x900. Compare with `docs/design/screens/Play-Mobile.png`, `Play--slim-rails.png` and `Play.png` by eye in the PR (attach the screenshots). Check no horizontal scroll at 390, no text under 12px, and tap targets ≥ 44px.

**Accept:** matches the listed screens for layout and colour. Keyboard can reach every toggle. `prefers-reduced-motion` disables pop-in animation.

---

## 0C. Backend play view and correct starting state (needs F0a on main)

Implement PLAN "Phase 0: State-loading evidence and fix" and the `play_view` projection exactly as written there. Summary:
- Load compiled, hash-pinned ruleset definitions into a typed initializer. The current `RulesetHarvester` reads `defaults` and drops `state_contributions`. Fill only absent initial values before the first save. Fail before any provider call if a required path is missing.
- Add `play_view` to `GET /api/chimera/play/:gameStateId`: pinned title, committed turn, known scene/time/presence, and the verified present modules with their ruleset source. Exclude `compiled_system_prompt`.
- Then swap the 0B fixture for the real `play_view`. The UI code must not change shape.

**Accept:** the tests listed in PLAN Phase 0. A Chimera-core session renders stamina/condition/satiety/pillars and **no** health bar.

---

## Out of scope for Phase 0

Typed narration and entity links (Phase 2), dossier content (Phase 3), the full Layout and HUD settings screen (can ship after 0B as a small follow-up), conversation mode, combat.

## Definition of done for every slice

- One focused PR per slice, with screenshots attached for UI work.
- `npm run type-check`, `npm run lint`, and the relevant `npm test` workspace pass. `node scripts/check-design-tokens.mjs` passes.
- No hardcoded sample names (Kiera, Daakon, the Gilded Stag) outside fixtures and tests.
- Any spec conflict is written in the PR description, not silently resolved.
