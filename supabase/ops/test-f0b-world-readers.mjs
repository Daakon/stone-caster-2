import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import { bootstrapLocalContentFleet } from "../../scripts/bootstrap-local-content-fleet.mjs";
const { Client } = createRequire(
  new URL("../../backend/package.json", import.meta.url),
)("pg");
const env = dotenv.parse(
  fs.readFileSync(new URL("../../.env.stonecaster-local", import.meta.url)),
);
const url = new URL(process.env.LOCAL_DATABASE_URL || env.DATABASE_URL);
assert.ok(
  ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.port === "54422" &&
    !url.search &&
    !url.hash,
);
assert.equal(env.SUPABASE_URL, "http://127.0.0.1:54421");
url.username = "supabase_admin";
Object.assign(process.env, env);
const { WorldContentReadService } =
  await import("../../backend/src/services/content/world-content-read.service.ts");
const { WorldContentReadRepository } =
  await import("../../backend/src/db/repos/world-content-read.repo.ts");
const { ContentCacheService } =
  await import("../../backend/src/services/content/content-cache.service.ts");
const { ContentChangePollerService } =
  await import("../../backend/src/services/content/content-change-poller.service.ts");
const { getChimeraSupabaseClient, getChimeraSupabaseAdminClient } =
  await import("../../backend/src/db/supabase-client.ts");
const { WorldReadQuerySchema } =
  await import("../../shared/src/types/chimera-world-read.ts");
const { configService } =
  await import("../../backend/src/services/config.service.ts");
const db = new Client({
  connectionString: url.href,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  lock_timeout: 1000,
});
const owner = randomUUID(),
  other = randomUUID(),
  admin = randomUUID(),
  firstId = randomUUID(),
  secondId = randomUUID(),
  prefix = `world-read-${randomUUID()}`;
let tail = Promise.resolve(),
  savepoint = 0;
function serial(job) {
  const pending = tail.then(job);
  tail = pending.catch(() => {});
  return pending;
}
function asRole(role, user, job) {
  return serial(async () => {
    const point = `reader_${++savepoint}`;
    await db.query(`savepoint ${point}`);
    try {
      await db.query(`set local role ${role}`);
      await db.query(
        "select set_config('request.jwt.claim.sub',coalesce($1::text,''),true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role',$2::text)::text,true)",
        [user, role],
      );
      return await job();
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "world_reader_fixture_query_failed",
          code: error.code,
          message: error.message,
        }),
      );
      throw error;
    } finally {
      await db.query(`rollback to savepoint ${point}`);
      await db.query(`release savepoint ${point}`);
    }
  });
}
const identityColumns =
  "id,key,slug,content_key,owner_kind,owner_namespace,owner_user_id,visibility";
async function fingerprint() {
  return (
    await db.query(
      "select (select generation::text from public.chimera_content_catalog_state where singleton) as catalog,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by content_kind,owner_namespace,content_key)::text,'[]')) from public.chimera_content_source_items s) as sources,(select count(*)::text from public.chimera_content_deploy_log) as receipts,(select md5(coalesce(jsonb_agg(to_jsonb(w) order by id)::text,'[]')) from public.chimera_worlds w) as worlds,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by seq)::text,'[]')) from public.chimera_content_changes s) as shared,(select md5(coalesce(jsonb_agg(to_jsonb(s))::text,'[]')) from public.chimera_content_change_state s) as state,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by user_id,seq)::text,'[]')) from public.chimera_owner_content_changes s) as private,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by user_id)::text,'[]')) from public.chimera_owner_content_generations s) as owners",
    )
  ).rows[0];
}
async function changePage(after, owners = []) {
  return asRole(
    "service_role",
    null,
    async () =>
      (
        await db.query(
          "select public.chimera_content_change_page($1,$2::jsonb,100) as value",
          [after, JSON.stringify(owners)],
        )
      ).rows[0].value,
  );
}
// The fixture adapter executes RLS queries on the same rollback transaction.
// Production PostgREST predicates, batching, projection and escaping have unit
// coverage and separate read-only SDK checks below.
function repository(user) {
  const role = user === null ? "anon" : "authenticated";
  const calls = { body: 0 };
  return {
    calls,
    isAdmin: () =>
      asRole(
        role,
        user,
        async () =>
          (await db.query("select public.is_admin() as value")).rows[0].value,
      ),
    resolve: (id) =>
      serial(async () =>
        (
          await db.query(
            `select ${identityColumns} from public.chimera_worlds where id::text=$1 or key=$1 or slug=$1 limit 2`,
            [id],
          )
        ).rows.length === 1
          ? (
              await db.query(
                `select ${identityColumns} from public.chimera_worlds where id::text=$1 or key=$1 or slug=$1 limit 1`,
                [id],
              )
            ).rows[0]
          : null,
      ),
    firstPartyAliases: (keys) =>
      serial(
        async () =>
          (
            await db.query(
              `select ${identityColumns} from public.chimera_worlds where owner_kind='first_party' and content_key=any($1)`,
              [keys],
            )
          ).rows,
      ),
    list: (lane, isAdmin, selectedOwner, query) =>
      asRole(role, user, async () => {
        calls.body++;
        const result =
          lane === "first_party"
            ? await db.query(
                "select * from public.chimera_content_source_items where content_kind='world' and owner_namespace='first_party' and ($1 or release_state='published') and ($2::text is null or body->'tags' @> jsonb_build_array($2)) order by body->>'name',owner_namespace,content_key limit $3",
                [isAdmin, query.tag ?? null, query.offset + query.limit],
              )
            : await db.query(
                "select * from public.chimera_worlds where owner_kind='player' and (case when $1='owner' then owner_user_id=$2::uuid else visibility='public' end) and ($3::text is null or tags @> array[$3]) order by name,owner_namespace,content_key limit $4",
                [
                  lane,
                  selectedOwner,
                  query.tag ?? null,
                  query.offset + query.limit,
                ],
              );
        return result.rows;
      }),
    find: (namespace, key, isAdmin, selectedOwner) =>
      asRole(role, user, async () => {
        calls.body++;
        const result =
          namespace === "first_party"
            ? await db.query(
                "select * from public.chimera_content_source_items where content_kind='world' and owner_namespace=$1 and content_key=$2 and ($3 or release_state='published')",
                [namespace, key, isAdmin],
              )
            : await db.query(
                "select * from public.chimera_worlds where owner_kind='player' and owner_namespace=$1 and content_key=$2 and (owner_user_id=$3::uuid or visibility='public')",
                [namespace, key, selectedOwner],
              );
        return result.rows[0] ?? null;
      }),
  };
}
await db.connect();
try {
  // Exercise actual SDK filters and SQL/JSON ordering without persistent fixtures.
  const liveRepo = new WorldContentReadRepository(
    getChimeraSupabaseClient(),
    getChimeraSupabaseAdminClient(),
  );
  for (const search of [
    'literal",visibility.eq.private,(name.ilike.*)',
    "100%_\\",
    "forest",
    "comma,colon:dot.",
  ]) {
    for (const lane of ["first_party", "public"])
      assert.ok(
        Array.isArray(
          await liveRepo.list(
            lane,
            false,
            null,
            WorldReadQuerySchema.parse({ search, tag: "fixture" }),
          ),
        ),
      );
  }
  assert.equal(await liveRepo.isAdmin(), false);
  const before = await fingerprint();
  await db.query("begin");
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}'),($3,$4,'{}'),($5,$6,'{}')",
    [
      owner,
      `${owner}@example.test`,
      other,
      `${other}@example.test`,
      admin,
      `${admin}@example.test`,
    ],
  );
  await db.query(
    "insert into public.profiles(id,role) values($1,'admin') on conflict(id) do update set role='admin'",
    [admin],
  );
  for (const [id, user] of [
    [firstId, owner],
    [secondId, other],
  ]) {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await db.query(
      "insert into public.chimera_worlds(id,key,name,slug,definition,owner_kind,owner_user_id,visibility,tags) values($1,$2,$3,$2,jsonb_build_object('summary','private fixture'),'player',$4,'private',array['fixture'])",
      [id, prefix, `Private ${user}`, user],
    );
    await db.query("reset role");
  }
  await bootstrapLocalContentFleet(
    db,
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  );
  const items = (
    await db.query(
      "select content_kind as kind,content_key as key,owner_namespace,content_format_version as format_version,body,content_refs as refs from public.chimera_content_source_items order by content_kind,content_key",
    )
  ).rows;
  const sample = items.find((row) => row.kind === "world");
  assert.ok(sample);
  const fixture = {
    ...sample,
    key: `${prefix}-first`,
    body: {
      ...sample.body,
      key: `${prefix}-first`,
      slug: `${prefix}-first`,
      name: "Current first-party fixture",
      tags: ["fixture"],
      definition: {
        ...sample.body.definition,
        key: `${prefix}-first`,
        name: "Current first-party fixture",
      },
    },
  };
  await db.query(
    "set local session authorization stonecaster_content_deployer",
  );
  try {
    await db.query(
      "select content_deploy.content_sync_apply((select catalog_generation from content_deploy.validation_formats limit 1),$1,$2::jsonb)",
      [
        randomUUID(),
        JSON.stringify({
          items: [...items, fixture],
          deployment: { commit_sha: "d".repeat(40) },
        }),
      ],
    );
  } finally {
    await db.query("reset session authorization");
  }
  const poller = new ContentChangePollerService({ page: changePage }),
    one = new ContentCacheService(poller),
    two = new ContentCacheService(poller);
  const ownerRepo = repository(owner),
    otherRepo = repository(other),
    anonRepo = repository(null),
    adminRepo = repository(admin);
  const mine = new WorldContentReadService(
      ownerRepo,
      owner,
      "fixture-owner",
      one,
    ),
    peer = new WorldContentReadService(ownerRepo, owner, "fixture-peer", two);
  const foreign = new WorldContentReadService(
      otherRepo,
      other,
      "fixture-other",
      one,
    ),
    publicReader = new WorldContentReadService(
      anonRepo,
      null,
      "fixture-public",
      one,
    ),
    internal = new WorldContentReadService(
      adminRepo,
      admin,
      "fixture-admin",
      one,
    );
  const params = WorldReadQuerySchema.parse({ tag: "fixture" });
  assert.equal((await mine.list(params, true))[0].id, firstId);
  assert.equal((await foreign.list(params, true))[0].id, secondId);
  assert.equal((await mine.find(firstId)).id, firstId);
  await peer.find(firstId);
  const bodyBefore = ownerRepo.calls.body;
  await mine.find(firstId);
  assert.equal(ownerRepo.calls.body, bodyBefore);
  await assert.rejects(foreign.find(firstId), { statusCode: 404 });
  await assert.rejects(publicReader.find(firstId), { statusCode: 404 });
  assert.equal(
    (await internal.find(fixture.key)).name,
    "Current first-party fixture",
  );
  await assert.rejects(publicReader.find(fixture.key), { statusCode: 404 });
  assert.equal((await publicReader.catalogList(params)).length, 0);
  const head = (await changePage(null)).shared.head_seq;
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query(
    "update public.chimera_worlds set name='Private update' where id=$1",
    [firstId],
  );
  await db.query("reset role");
  assert.equal((await changePage(null)).shared.head_seq, head);
  assert.equal((await mine.find(firstId)).name, "Private update");
  assert.equal((await peer.find(firstId)).name, "Private update");
  assert.equal((await foreign.list(params, true))[0].id, secondId);
  // Maintenance-only release fixture: no production publish action is added here.
  await db.query("set local role stonecaster_content_sync_owner");
  await db.query(
    "update public.chimera_content_source_items set release_state='published' where content_kind='world' and content_key=$1",
    [fixture.key],
  );
  await db.query("reset role");
  assert.equal(
    (await publicReader.find(fixture.key)).name,
    "Current first-party fixture",
  );
  assert.equal((await publicReader.catalogList(params))[0].id, fixture.key);
  await db.query("set local role stonecaster_content_sync_owner");
  await db.query(
    "update public.chimera_content_source_items set release_state='internal' where content_kind='world' and content_key=$1",
    [fixture.key],
  );
  await db.query("reset role");
  await assert.rejects(publicReader.find(fixture.key), { statusCode: 404 });
  assert.equal((await publicReader.catalogList(params)).length, 0);
  for (const visibility of ["public", "private", "public"]) {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      owner,
    ]);
    await db.query(
      "update public.chimera_worlds set visibility=$1 where id=$2",
      [visibility, firstId],
    );
    await db.query("reset role");
    if (visibility === "public")
      assert.equal((await publicReader.find(firstId)).name, "Private update");
    else await assert.rejects(publicReader.find(firstId), { statusCode: 404 });
    const visible = await mine.list(params);
    assert.equal(visible.filter((row) => row.id === firstId).length, 1);
  }
  assert.equal((await publicReader.catalogList(params))[0].id, firstId);
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query("delete from public.chimera_worlds where id=$1", [firstId]);
  await db.query("reset role");
  await assert.rejects(mine.find(firstId), { statusCode: 404 });
  assert.equal((await publicReader.catalogList(params)).length, 0);
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  console.log(
    "PASS actual SDK filter escaping/order, real anon/owner/admin RLS, canonical release gating, owner isolation, private replay on two cache instances, public visibility/delete invalidation, hit body reuse, and unchanged rollback fingerprints",
  );
} finally {
  await tail;
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
