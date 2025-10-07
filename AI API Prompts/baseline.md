# StoneCaster Prompt v2 — Baseline File Set (Core / World / Adventure)

> Stateless-ready, multi‑world architecture. These are **prompt digests**: concise, model‑facing inputs. Validation/repair lives in your backend. Runtime game state is merged separately per turn (player position, worn items, conditions, relationships, clocks, etc.).

## Folder Layout

```
/prompts_v2/
  core.prompt.json
  /worlds/
    /mystika/
      world.prompt.json
      /adventures/
        /whispercross/
          adventure.prompt.json
```

---

## 1) `core.prompt.json` (world‑agnostic)

> Single source for AWF return format, universal turn discipline, cross‑genre skills, relationships, consent/safety, **time & fatigue**, NPC goals, and objective scheduling. Keep this **short** and stable.

```json

```

---

## 2) `world.prompt.json` (example: Mystika)

> The per‑world “law” and flavor mechanics, compact. Replace values for other worlds.

```json

```

---

## 3) `adventure.prompt.json` (example: Whispercross)

> Scene graph slice + minimal NPC/Place facts used in the **current** turn. At runtime, include **only the active scene + adjacents**.

```json

```

---

## Runtime State (separate; merged per call)

> Not a file here—your backend emits this each turn to keep the API stateless.

```json

```

---

### Usage Notes

* **Prompt each turn** = `core.prompt.json` + active `world.prompt.json` + active slice of `adventure.prompt.json` + **Runtime State** + **player input**.
* Keep each file concise; avoid examples and long prose.
* Validation, repair, and rendering are strictly server concerns.

If you want, I can also generate **Aetherium (sci‑fi) world.prompt.json** and a sample cyberpunk adventure to show cross‑genre skill mapping in action.

```
```
