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
const { TagContentReadService } =
  await import("../../backend/src/services/content/tag-content-read.service.ts");
const { TagContentReadRepository } =
  await import("../../backend/src/db/repos/tag-content-read.repo.ts");
const { TagReadQuerySchema } =
  await import("../../shared/src/types/chimera-tag-read.ts");
const { getChimeraSupabaseClient, getChimeraSupabaseAdminClient } =
  await import("../../backend/src/db/supabase-client.ts");
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
  first = randomUUID(),
  foreign = randomUUID(),
  unapproved = randomUUID(),
  prefix = `tag-read-${randomUUID()}`;
let tail = Promise.resolve(),
  savepoint = 0;
function serial(job) {
  const result = tail.then(job);
  tail = result.catch(() => {});
  return result;
}
function asRole(role, user, job) {
  return serial(async () => {
    const point = `tags_${++savepoint}`;
    await db.query(`savepoint ${point}`);
    try {
      await db.query(`set local role ${role}`);
      await db.query(
        "select set_config('request.jwt.claim.sub',coalesce($1::text,''),true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role',$2::text)::text,true)",
        [user, role],
      );
      return await job();
    } finally {
      await db.query(`rollback to savepoint ${point}`);
      await db.query(`release savepoint ${point}`);
    }
  });
}
// Production repository parsing/parameters, real-role SQL RPC. Fixtures never leave this transaction.
function repository(user) {
  return new TagContentReadRepository({
    rpc: (name, args) => {
      assert.equal(name, "chimera_approved_tag_page");
      assert.deepEqual(Object.keys(args).sort(), ["p_limit", "p_offset"]);
      return {
        abortSignal: () => ({
          overrideTypes: async () => ({
            data: await asRole(
              "authenticated",
              user,
              async () =>
                (
                  await db.query(
                    "select public.chimera_approved_tag_page($1,$2) as value",
                    [args.p_limit, args.p_offset],
                  )
                ).rows[0].value,
            ),
            error: null,
          }),
        }),
      };
    },
  });
}
async function write(user, sql, values) {
  await db.query("set local role authenticated");
  try {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role','authenticated')::text,true)",
      [user],
    );
    await db.query(sql, values);
  } finally {
    await db.query("reset role");
  }
}
async function release(key, state) {
  await db.query("set local role stonecaster_content_sync_owner");
  try {
    await db.query(
      "update public.chimera_content_source_items set release_state=$1 where content_kind='tag' and content_key=$2",
      [state, key],
    );
  } finally {
    await db.query("reset role");
  }
}
async function fingerprint() {
  const result = {};
  for (const table of [
    "chimera_content_catalog_state",
    "chimera_content_source_items",
    "chimera_content_deploy_log",
    "chimera_tags",
    "chimera_asset_tags",
    "chimera_content_changes",
    "chimera_content_change_state",
    "chimera_owner_content_changes",
    "chimera_owner_content_generations",
    "chimera_content_runtime_fleet",
    "chimera_content_runtime_builds",
    "profiles",
  ]) {
    result[table] = (
      await db.query(
        `select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) as value from public.${table} t`,
      )
    ).rows[0].value;
  }
  return result;
}
async function posture() {
  return (
    await db.query(
      "select c.relname,c.relrowsecurity,c.relacl::text,(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies from pg_class c where c.oid in ('public.chimera_tags'::regclass,'public.chimera_content_source_items'::regclass) order by c.relname",
    )
  ).rows;
}
await db.connect();
try {
  // Actual SDK transport denies both anonymous and service-role invocation.
  for (const client of [
    getChimeraSupabaseClient(),
    getChimeraSupabaseAdminClient(),
  ]) {
    const { error } = await client
      .rpc("chimera_approved_tag_page", { p_limit: 1, p_offset: 0 })
      .abortSignal(AbortSignal.timeout(2000));
    assert.equal(error?.code, "42501");
  }
  const before = await fingerprint(),
    beforePosture = await posture();
  await db.query("begin");
  const migration = fs.readFileSync(
    new URL(
      "../migrations/20261010000000_approved_tag_selector.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.query(migration);
  await db.query(migration);
  assert.deepEqual(await posture(), beforePosture);
  assert.deepEqual(
    (
      await db.query(
        "select prosecdef,provolatile,has_function_privilege('anon',oid,'EXECUTE') as anon,has_function_privilege('authenticated',oid,'EXECUTE') as authenticated,has_function_privilege('service_role',oid,'EXECUTE') as service_role,not exists(select 1 from aclexplode(proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_revoked from pg_proc where oid='public.chimera_approved_tag_page(integer,integer)'::regprocedure",
      )
    ).rows[0],
    {
      prosecdef: false,
      provolatile: "s",
      anon: false,
      authenticated: true,
      service_role: false,
      public_revoked: true,
    },
  );
  for (const user of [owner, other, admin])
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",
      [user, user + "@example.test"],
    );
  await db.query(
    "insert into public.profiles(id,role) values($1,'admin') on conflict(id) do update set role='admin'",
    [admin],
  );
  for (const [id, user, name, approved] of [
    [first, owner, prefix + " A", true],
    [foreign, other, prefix + " FOREIGN", true],
    [unapproved, owner, prefix + " UNAPPROVED", false],
  ])
    await write(
      user,
      "insert into public.chimera_tags(id,tag_name,is_approved,owner_kind,owner_user_id) values($1,$2,$3,'player',$4)",
      [id, name, approved, user],
    );
  await bootstrapLocalContentFleet(
    db,
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  );
  const items = (
    await db.query(
      "select content_kind as kind,content_key as key,owner_namespace,content_format_version as format_version,body,content_refs as refs from public.chimera_content_source_items order by content_kind,content_key",
    )
  ).rows;
  const sample = items.find((i) => i.kind === "tag");
  assert.ok(sample);
  const canonical = {
    ...sample,
    key: prefix + "-canonical",
    body: {
      key: prefix + "-canonical",
      tag_name: prefix + " A",
      is_approved: true,
    },
  };
  const rejected = [
    {
      key: prefix + "-unapproved",
      body: { tag_name: prefix + " REJECTED", is_approved: false },
    },
    {
      key: prefix + "-missing-approval",
      body: { tag_name: prefix + " MISSING" },
    },
    {
      key: prefix + "-string-approval",
      body: { tag_name: prefix + " STRING", is_approved: "true" },
    },
    { key: prefix + "-missing-name", body: { is_approved: true } },
    {
      key: prefix + "-numeric-name",
      body: { tag_name: 42, is_approved: true },
    },
  ].map((v) => ({ ...sample, ...v }));
  await db.query(
    "set local session authorization stonecaster_content_deployer",
  );
  try {
    await db.query(
      "select content_deploy.content_sync_apply((select catalog_generation from content_deploy.validation_formats limit 1),$1,$2::jsonb)",
      [
        randomUUID(),
        JSON.stringify({
          items: [...items, canonical, ...rejected],
          deployment: { commit_sha: "f".repeat(40) },
        }),
      ],
    );
  } finally {
    await db.query("reset session authorization");
  }
  const build = (user) =>
    new TagContentReadService(repository(user), user, "tag-rollback");
  const mine = build(owner),
    peer = build(owner),
    theirs = build(other),
    preview = build(admin),
    params = TagReadQuerySchema.parse({});
  const all = async (service) => {
    const rows = [];
    for (let offset = 0; offset <= 1000; offset += 50) {
      const page = await service.list({ limit: 50, offset });
      rows.push(...page);
      if (page.length < 50) break;
    }
    return rows;
  };
  assert.deepEqual(await mine.list(params), [
    { id: first, tag_name: prefix + " A", is_approved: true },
  ]);
  assert.deepEqual(await theirs.list(params), [
    { id: foreign, tag_name: prefix + " FOREIGN", is_approved: true },
  ]);
  assert.ok((await all(preview)).some((t) => t.id === canonical.key));
  assert.ok(
    !(await all(preview)).some((t) =>
      [first, foreign, unapproved].includes(t.id),
    ),
  );
  for (const v of rejected) await release(v.key, "published");
  assert.deepEqual(await mine.list(params), [
    { id: first, tag_name: prefix + " A", is_approved: true },
  ]);
  for (const [limit, offset] of [
    [0, 0],
    [51, 0],
    [1, -1],
    [1, 1001],
    [null, 0],
    [1, null],
  ])
    await assert.rejects(
      asRole("authenticated", owner, () =>
        db.query("select public.chimera_approved_tag_page($1,$2)", [
          limit,
          offset,
        ]),
      ),
      { code: "22023" },
    );
  await assert.rejects(
    asRole("authenticated", null, () =>
      db.query("select public.chimera_approved_tag_page()"),
    ),
    { code: "42501" },
  );
  for (const role of ["anon", "service_role"])
    await assert.rejects(
      asRole(role, owner, () =>
        db.query("select public.chimera_approved_tag_page()"),
      ),
      { code: "42501" },
    );
  await release(canonical.key, "published");
  const published = await mine.list(params);
  assert.equal(published.length, 2);
  assert.deepEqual(
    new Set(published.map((t) => t.id)),
    new Set([first, canonical.key]),
  );
  assert.deepEqual(await peer.list(params), published);
  assert.deepEqual(
    await mine.list({ limit: 1, offset: 0 }),
    published.slice(0, 1),
  );
  assert.deepEqual(
    await mine.list({ limit: 1, offset: 1 }),
    published.slice(1, 2),
  );
  assert.deepEqual(await mine.list({ limit: 1, offset: 2 }), []);
  // Private rename/removal must remain fresh on both services and never advance the shared stream.
  const sharedHead = async () =>
    (
      await db.query(
        "select head_seq::text from public.chimera_content_change_state where singleton",
      )
    ).rows[0].head_seq;
  const head = await sharedHead();
  await write(owner, "update public.chimera_tags set tag_name=$1 where id=$2", [
    prefix + " RENAMED",
    first,
  ]);
  assert.equal(await sharedHead(), head);
  for (const service of [mine, peer])
    assert.equal(
      (await service.list(params)).find((t) => t.id === first).tag_name,
      prefix + " RENAMED",
    );
  await write(
    owner,
    "update public.chimera_tags set is_approved=false where id=$1",
    [first],
  );
  for (const service of [mine, peer])
    assert.ok(!(await service.list(params)).some((t) => t.id === first));
  assert.equal(await sharedHead(), head);
  await release(canonical.key, "internal");
  for (const service of [mine, peer])
    assert.deepEqual(await service.list(params), []);
  assert.ok((await all(preview)).some((t) => t.id === canonical.key));
  await db.query("update public.profiles set role='member' where id=$1", [
    admin,
  ]);
  assert.deepEqual(await preview.list(params), []);
  const privateHead = await sharedHead();
  await write(
    owner,
    "insert into public.chimera_tags(tag_name,is_approved,owner_kind,owner_user_id) select $1||' X_'||lpad(i::text,4,'0'),true,'player',$2::uuid from generate_series(1,1061) i",
    [prefix, owner],
  );
  const deep = await mine.list({ limit: 50, offset: 1000 });
  assert.equal(deep.length, 50);
  assert.equal(deep[0].tag_name, prefix + " X_1001");
  assert.equal(deep[49].tag_name, prefix + " X_1050");
  assert.deepEqual(await peer.list({ limit: 50, offset: 1000 }), deep);
  assert.deepEqual(await theirs.list(params), [
    { id: foreign, tag_name: prefix + " FOREIGN", is_approved: true },
  ]);
  assert.equal(await sharedHead(), privateHead);
  await write(owner, "delete from public.chimera_tags where id=$1", [first]);
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  assert.deepEqual(await posture(), beforePosture);
  console.log(
    "PASS SDK anonymous/service-role denial, invoker/grant/RLS posture and idempotent migration, production reader over real-role RPC, canonical published/internal/approval gates, owner isolation (including admin), same-name stable IDs and merged pagination beyond 1000 rows, fresh rename/unapproval/release/admin revocation across two readers, private shared-stream non-interference, rollback fingerprints unchanged",
  );
} finally {
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
