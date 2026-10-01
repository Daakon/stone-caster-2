import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

const localOnly = describe;
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const adminId = "00000000-0000-4000-8000-00000000a001";
const playerId = "00000000-0000-4000-8000-00000000b001";

localOnly("frozen play across source sync and recompile", () => {
  it("keeps the old session on its pinned hash, values and prompts while a new session gets the new hash", async () => {
    const env = dotenv.parse(
      fs.readFileSync(path.join(root, ".env.stonecaster-local")),
    );
    const dbUrl = new URL(process.env.LOCAL_DATABASE_URL || env.DATABASE_URL);
    const apiUrl = new URL(env.API_BASE_URL);
    const supabaseUrl = new URL(env.SUPABASE_URL);
    for (const url of [dbUrl, apiUrl, supabaseUrl])
      expect(["localhost", "127.0.0.1", "::1"]).toContain(
        url.hostname.toLowerCase(),
      );
    expect(dbUrl.pathname).toBe("/postgres");
    const authResponse = await fetch(
      new URL("/auth/v1/token?grant_type=password", supabaseUrl),
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "admin@stonecaster.local",
          password: "stonecaster-dev",
        }),
      },
    );
    const auth = await authResponse.json();
    expect(authResponse.status, JSON.stringify(auth)).toBe(200);
    expect(auth.user?.id).toBe(adminId);
    const token = auth.access_token;
    const request = async (route: string, body: unknown) => {
      const response = await fetch(new URL(route, apiUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      expect(response.status, JSON.stringify(result)).toBeLessThan(300);
      return result.data;
    };
    const admin = new pg.Client({ connectionString: dbUrl.toString() });
    await admin.connect();
    const worldId = randomUUID();
    const characterId = randomUUID();
    const playerCharacterId = randomUUID();
    const games: string[] = [];
    const compiles: string[] = [];
    let deployer: pg.Client | undefined;
    let original: Record<string, any> | undefined;
    let sourceEdited = false;
    const selection = {
      world: { kind: "world", owner_namespace: "first_party", key: "mystika" },
      rulesets: [
        {
          kind: "ruleset",
          owner_namespace: "first_party",
          key: "vitality-stamina-system",
        },
      ],
      entities: [],
      lore: [],
    };
    const readCompile = async (id: string) => {
      const { rows } = await admin.query(
        `select c.id, c.payload_blob_hash, b.body->'body' as payload
        from public.chimera_compiled_stories c join public.chimera_content_blobs b on b.sha256=c.payload_blob_hash
        where c.id=$1`,
        [id],
      );
      expect(rows).toHaveLength(1);
      return rows[0];
    };
    const readState = async (id: string) => {
      const { rows } = await admin.query(
        "select compiled_story_id, mechanical_state from public.chimera_game_states where id=$1",
        [id],
      );
      expect(rows).toHaveLength(1);
      return rows[0];
    };
    const sync = async (items: Record<string, any>[]) => {
      const { rows: generation } = await deployer!.query(
        "select catalog_generation from content_deploy.validation_formats limit 1",
      );
      const bundle = {
        items: items.map((item) => ({
          ...item,
          owner_namespace: "first_party",
          format_version: 1,
        })),
      };
      await deployer!.query(
        "select content_deploy.content_sync_apply($1::bigint,$2::uuid,$3::jsonb)",
        [
          Number(generation[0].catalog_generation),
          randomUUID(),
          JSON.stringify(bundle),
        ],
      );
    };
    try {
      await admin.query(
        `insert into public.chimera_worlds(id,key,definition,name,slug,owner_user_id)
        values($1,$2,$3,$4,$5,$6)`,
        [
          worldId,
          `frozen-test-${worldId}`,
          JSON.stringify({ test: true }),
          "Frozen test fixture",
          `frozen-test-${worldId}`,
          adminId,
        ],
      );
      await admin.query(
        `insert into public.chimera_player_characters(id,user_id,name,state_snapshot,world_id)
        values($1,$2,$3,$4,$5)`,
        [characterId, adminId, "Pin Test Hero", "{}", worldId],
      );
      await admin.query(
        `insert into public.chimera_player_characters(id,user_id,name,state_snapshot,world_id)
        values($1,$2,$3,$4,$5)`,
        [playerCharacterId, playerId, "Tester Hero", "{}", worldId],
      );

      const oldId = (await request("/api/chimera/compile", selection)).id;
      compiles.push(oldId);
      const oldCompile = await readCompile(oldId);
      const oldRuleset = oldCompile.payload.config_engine.active_rulesets[0];
      const oldValue =
        oldRuleset.definition.state_contributions.tier1_entity.definitions
          .current_stamina.value;
      const oldPrompt = oldCompile.payload.prompt_interpreter_logic;
      expect(typeof oldPrompt).toBe("string");
      const retired = await fetch(new URL("/api/chimera/play/start", apiUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ compiledStoryId: oldId }),
      });
      expect(retired.status).toBe(410);
      expect(JSON.stringify(await retired.json())).toContain(
        "/api/chimera/game/init",
      );

      const playerAuthResponse = await fetch(
        new URL("/auth/v1/token?grant_type=password", supabaseUrl),
        {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email: "player@stonecaster.local",
            password: "stonecaster-dev",
          }),
        },
      );
      const playerAuth = await playerAuthResponse.json();
      expect(playerAuthResponse.status).toBe(200);
      const playerInitBody = {
        storyId: oldId,
        characterId: playerCharacterId,
        playerInput: { identity: { name: "Tester Hero" } },
      };
      const playerInit = async () =>
        fetch(new URL("/api/chimera/game/init", apiUrl), {
          method: "POST",
          headers: {
            authorization: `Bearer ${playerAuth.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(playerInitBody),
        });
      const denied = await playerInit();
      expect(denied.status).toBe(403);
      expect(JSON.stringify(await denied.json())).toContain("approved testers");
      await admin.query(
        "insert into public.chimera_prelaunch_testers(user_id) values($1)",
        [playerId],
      );
      const testerInit = await playerInit();
      const testerBody = await testerInit.json();
      expect(testerInit.status, JSON.stringify(testerBody)).toBe(201);
      games.push(testerBody.data.id);
      expect((await readState(testerBody.data.id)).compiled_story_id).toBe(
        oldId,
      );
      const oldGame = (
        await request("/api/chimera/game/init", {
          storyId: oldId,
          characterId,
          playerInput: { identity: { name: "Pin Test Hero" } },
        })
      ).id;
      games.push(oldGame);
      await request(`/api/games/${oldGame}/turn`, { input: "test_social" });
      const before = await readState(oldGame);
      expect(before.compiled_story_id).toBe(oldId);
      expect(
        before.mechanical_state.entities[characterId].properties
          .current_stamina,
      ).toBe(oldValue);

      const { rows: source } =
        await admin.query(`select body, content_refs from public.chimera_content_source_items
        where content_kind='ruleset' and owner_namespace='first_party' and content_key='vitality-stamina-system'`);
      expect(source).toHaveLength(1);
      original = {
        kind: "ruleset",
        key: "vitality-stamina-system",
        body: source[0].body,
        refs: source[0].content_refs,
      };
      const dependencyItems: Record<string, any>[] = [];
      for (const ref of original.refs) {
        const { rows } = await admin.query(
          `select body,content_refs from public.chimera_content_source_items
          where content_kind=$1 and owner_namespace=$2 and content_key=$3`,
          [ref.kind, ref.owner_namespace, ref.key],
        );
        expect(rows).toHaveLength(1);
        dependencyItems.push({
          kind: ref.kind,
          key: ref.key,
          body: rows[0].body,
          refs: rows[0].content_refs,
        });
      }
      const password = randomBytes(32).toString("base64url");
      const { rows: statement } = await admin.query(
        "select format('alter role stonecaster_content_deployer login noinherit password %L', $1::text) as sql",
        [password],
      );
      await admin.query(statement[0].sql);
      const deployUrl = new URL(dbUrl);
      deployUrl.username = "stonecaster_content_deployer";
      deployUrl.password = password;
      deployer = new pg.Client({ connectionString: deployUrl.toString() });
      await deployer.connect();
      const changed = structuredClone(original);
      changed.body.definition.state_contributions.tier1_entity.definitions.current_stamina.value =
        oldValue + 23;
      changed.body.definition.ai_instructions ??= {};
      changed.body.definition.ai_instructions.mas1_interpreter =
        "PIN_TEST_NEW_INTERPRETER_PROMPT";
      changed.body.definition.ai_instructions.mas2_narrator =
        "PIN_TEST_NEW_NARRATOR_PROMPT";
      await sync([changed, ...dependencyItems]);
      sourceEdited = true;

      const newId = (await request("/api/chimera/compile", selection)).id;
      compiles.push(newId);
      const newCompile = await readCompile(newId);
      expect(newCompile.payload_blob_hash).not.toBe(
        oldCompile.payload_blob_hash,
      );
      expect(newCompile.payload.prompt_interpreter_logic).toContain(
        "PIN_TEST_NEW_INTERPRETER_PROMPT",
      );
      expect(newCompile.payload.prompt_narrator_style).toContain(
        "PIN_TEST_NEW_NARRATOR_PROMPT",
      );
      expect(
        newCompile.payload.config_engine.active_rulesets[0].definition
          .state_contributions.tier1_entity.definitions.current_stamina.value,
      ).toBe(oldValue + 23);

      await request(`/api/games/${oldGame}/turn`, { input: "test_social" });
      const after = await readState(oldGame);
      const stillPinned = await readCompile(after.compiled_story_id);
      expect(after.compiled_story_id).toBe(oldId);
      expect(stillPinned.payload_blob_hash).toBe(oldCompile.payload_blob_hash);
      expect(stillPinned.payload.prompt_interpreter_logic).toBe(oldPrompt);
      expect(stillPinned.payload.prompt_narrator_style).toBe(
        oldCompile.payload.prompt_narrator_style,
      );
      expect(
        after.mechanical_state.entities[characterId].properties.current_stamina,
      ).toBe(oldValue);
      const oldViewResponse = await fetch(
        new URL(`/api/chimera/play/${oldGame}`, apiUrl),
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const oldView = await oldViewResponse.json();
      expect(oldViewResponse.status, JSON.stringify(oldView)).toBe(200);
      expect(oldView.data.compiled_story_id).toBe(oldId);
      expect(oldView.data.compiled_system_prompt).toBe(
        oldCompile.payload.prompt_narrator_style,
      );

      const newGame = (
        await request("/api/chimera/game/init", {
          storyId: newId,
          characterId,
          playerInput: { identity: { name: "Pin Test Hero" } },
        })
      ).id;
      games.push(newGame);
      const newState = await readState(newGame);
      expect(newState.compiled_story_id).toBe(newId);
      expect(
        newState.mechanical_state.entities[characterId].properties
          .current_stamina,
      ).toBe(oldValue + 23);
    } finally {
      if (deployer && original && sourceEdited)
        await sync([
          original,
          ...(await Promise.all(
            original.refs.map(async (ref: any) => {
              const { rows } = await admin.query(
                `select body,content_refs from public.chimera_content_source_items
          where content_kind=$1 and owner_namespace=$2 and content_key=$3`,
                [ref.kind, ref.owner_namespace, ref.key],
              );
              return {
                kind: ref.kind,
                key: ref.key,
                body: rows[0].body,
                refs: rows[0].content_refs,
              };
            }),
          )),
        ]);
      if (deployer) await deployer.end();
      for (const id of games) {
        await admin.query("delete from public.ai_audit_logs where game_id=$1", [
          id,
        ]);
        await admin.query(
          "delete from public.chimera_turns where game_state_id=$1",
          [id],
        );
        await admin.query(
          "delete from public.chimera_game_states where id=$1",
          [id],
        );
      }
      for (const id of compiles)
        await admin.query(
          "delete from public.chimera_compiled_stories where id=$1",
          [id],
        );
      await admin.query(
        "delete from public.chimera_player_characters where id=$1",
        [characterId],
      );
      await admin.query(
        "delete from public.chimera_player_characters where id=$1",
        [playerCharacterId],
      );
      await admin.query(
        "delete from public.chimera_prelaunch_testers where user_id=$1",
        [playerId],
      );
      await admin.query("delete from public.chimera_worlds where id=$1", [
        worldId,
      ]);
      await admin.end();
    }
  }, 120_000);
});
