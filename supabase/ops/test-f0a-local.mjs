import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const localEnv = dotenv.parse(fs.readFileSync(path.join(root, '.env.stonecaster-local')));
const adminUrl = process.env.LOCAL_DATABASE_URL || localEnv.DATABASE_URL;
const deployUrl = process.env.CONTENT_DEPLOY_DATABASE_URL;
const isLoopback = (value) => ['localhost','127.0.0.1','::1','[::1]'].includes(new URL(value).hostname.toLowerCase());
if (!adminUrl || !deployUrl || !isLoopback(adminUrl) || !isLoopback(deployUrl)) {
  throw new Error('F0a database acceptance tests require both database URLs to point to loopback only.');
}

const admin = new pg.Client({connectionString:adminUrl, application_name:'stonecaster-f0a-local-test'});
const deployer = new pg.Client({connectionString:deployUrl, application_name:'stonecaster-f0a-role-test'});
const filesRoot = path.join(root, 'content/first-party');
const manifest = JSON.parse(fs.readFileSync(path.join(filesRoot, 'manifest.json'), 'utf8'));
const allItems = manifest.files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(filesRoot, file), 'utf8')).items);
const byIdentity = new Map(allItems.map((item) => [`${item.kind}\0${item.key}`, item]));
const testAdminId = '00000000-0000-4000-8000-00000000a001';
const testPlayerId = '00000000-0000-4000-8000-00000000b001';

function report(name) {
  process.stdout.write(`PASS ${name}\n`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

function contentHash(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

async function mustBeDenied(client, name, sql, params = []) {
  let error;
  try { await client.query(sql, params); } catch (caught) { error = caught; }
  assert.ok(error, `${name} unexpectedly succeeded`);
  assert.equal(error.code, '42501', `${name} failed for a reason other than insufficient privilege: ${error.message}`);
}

async function loadStoredItems() {
  const {rows} = await admin.query(`
    select content_kind, owner_namespace, content_key, content_format_version, body, content_refs, content_hash
    from public.chimera_content_source_items where owner_namespace='first_party'
    order by content_kind, content_key
  `);
  return rows;
}

async function applyLocalBundle(items) {
  const {rows: generationRows} = await deployer.query('select catalog_generation from content_deploy.validation_formats limit 1');
  assert.ok(generationRows.length, 'deployer cannot read the validation format view');
  const bundle = {items:items.map((item) => ({...item, owner_namespace:'first_party', format_version:1}))};
  const {rows} = await deployer.query(
    'select content_deploy.content_sync_apply($1::bigint, $2::uuid, $3::jsonb) as receipt',
    [Number(generationRows[0].catalog_generation), randomUUID(), JSON.stringify(bundle)],
  );
  return rows[0].receipt;
}

async function publishAsAdmin(generation, title, refs, payload) {
  await admin.query('begin');
  try {
    await admin.query('set local role authenticated');
    await admin.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',json_build_object('sub',$1,'role','authenticated')::text,true)", [testAdminId]);
    const {rows} = await admin.query('select public.publish_frozen_chimera_compile($1::bigint,null,$2::text,$3::jsonb,$4::jsonb) as id',
      [generation, title, JSON.stringify(refs), JSON.stringify(payload)]);
    await admin.query('commit');
    return rows[0].id;
  } catch (error) {
    await admin.query('rollback').catch(() => undefined);
    throw error;
  }
}

try {
  await admin.connect();
  await deployer.connect();

  const {rows: roleRows} = await admin.query(`
    select r.rolcanlogin, r.rolinherit, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
           (select count(*) from pg_auth_members m where m.member=r.oid) as memberships,
           (select count(*) from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid and p.rolname='stonecaster_content_sync_owner') as forbidden_owner_memberships
    from pg_roles r where r.rolname='stonecaster_content_deployer'
  `);
  assert.equal(roleRows.length, 1, 'dedicated deploy role is missing');
  assert.equal(roleRows[0].rolcanlogin, true);
  assert.equal(roleRows[0].rolinherit, false);
  for (const key of ['rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls']) assert.equal(roleRows[0][key], false, `${key} must be false`);
  assert.equal(Number(roleRows[0].memberships), 0, 'deploy role has an unexpected role membership');
  const {rows: ownerRows} = await admin.query("select rolcanlogin from pg_roles where rolname='stonecaster_content_sync_owner'");
  assert.equal(ownerRows[0]?.rolcanlogin, false, 'sync function owner must not be able to log in');
  report('dedicated deploy login is NOINHERIT and non-privileged; function owner cannot log in');

  const {rows: formatRows} = await deployer.query('select content_kind, supported_format_version, catalog_generation from content_deploy.validation_formats');
  assert.ok(formatRows.some((row) => row.content_kind === 'world' && row.supported_format_version === 1));
  await mustBeDenied(deployer, 'direct source table read', 'select * from public.chimera_content_source_items limit 0');
  await mustBeDenied(deployer, 'direct source table insert', 'insert into public.chimera_content_source_items default values');
  const allowedFunctions = await deployer.query(`
    select p.oid::regprocedure::text as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='content_deploy' and has_function_privilege(current_user,p.oid,'EXECUTE')
  `);
  assert.deepEqual(allowedFunctions.rows.map((row) => row.signature), ['content_deploy.content_sync_apply(bigint,uuid,jsonb)']);
  const {rows: execRows} = await admin.query(`
    select n.nspname, p.oid::regprocedure::text as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and has_function_privilege('stonecaster_content_deployer',p.oid,'EXECUTE')
      and not exists (
        select 1 from pg_depend d
        where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'
      )
  `);
  assert.deepEqual(execRows.map((row) => row.signature), [], 'deploy role has unexpected public function execution');

  const protectedTables = [
    ['auth','users'], ['public','profiles'], ['public','auth_ledger'], ['public','chimera_game_states'],
    ['public','chimera_turns'], ['public','pricing_config'], ['public','app_config'],
  ];
  for (const [schema, table] of protectedTables) {
    const {rows: columnRows} = await admin.query(`
      select column_name from information_schema.columns
      where table_schema=$1 and table_name=$2 order by ordinal_position limit 1
    `, [schema, table]);
    assert.ok(columnRows.length, `required privilege-test table is missing: ${schema}.${table}`);
    const qname = `"${schema}"."${table}"`;
    const qcolumn = `"${columnRows[0].column_name}"`;
    for (const [operation, sql] of [
      ['SELECT', `select * from ${qname} limit 0`],
      ['INSERT', `insert into ${qname} default values`],
      ['UPDATE', `update ${qname} set ${qcolumn}=${qcolumn} where false`],
      ['DELETE', `delete from ${qname} where false`],
    ]) await mustBeDenied(deployer, `${operation} ${schema}.${table}`, sql);
  }
  for (const [name, sql] of [
    ['admin role function', "select public.assign_admin_role('00000000-0000-4000-8000-00000000b001'::uuid)"],
    ['user role function', "select public.update_user_role('00000000-0000-4000-8000-00000000b001'::uuid, 'admin')"],
  ]) await mustBeDenied(deployer, name, sql);
  report('deploy login cannot read or write accounts, ledger, games, turns, pricing, or system config');

  const {rows: sourceRows} = await admin.query(`
    select content_kind, owner_namespace, content_key, content_hash, body, content_refs, content_format_version
    from public.chimera_content_source_items where owner_namespace='first_party'
  `);
  assert.equal(sourceRows.length, allItems.length, 'local sync did not load every first-party repo item');
  const storedHashByKey = new Map(sourceRows.map((row) => [`${row.content_kind}\0${row.content_key}`, row.content_hash]));
  for (const item of allItems) {
    const storedHash = storedHashByKey.get(`${item.kind}\0${item.key}`);
    assert.ok(storedHash, `local sync missed ${item.kind}:${item.key}`);
    assert.equal(storedHash, contentHash({format_version:1,body:item.body,refs:item.refs}), `canonical hash differs for ${item.kind}:${item.key}`);
  }
  report(`local deploy role synced ${sourceRows.length} repo items through the fixed security-definer function`);

  for (const role of ['authenticated','service_role']) {
    await admin.query('begin');
    try {
      await admin.query(`set local role ${role}`);
      if (role === 'authenticated') await admin.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',json_build_object('sub',$1,'role','authenticated')::text,true)", [testPlayerId]);
      let error;
      try {
        await admin.query(`
          insert into public.chimera_worlds (key, content_key, owner_kind, owner_namespace, owner_user_id, name, slug, definition)
          values ('spoofed-first-party','spoofed-first-party','first_party','first_party',null,'spoofed','spoofed','{}'::jsonb)
        `);
      } catch (caught) { error = caught; }
      assert.ok(error, `${role} inserted a first-party world`);
      assert.equal(error.code, 'P0001', `${role} was denied outside the ownership trigger: ${error.message}`);
      assert.match(error.message, /only the content sync function may write first-party content|players and service routes cannot author references to first-party content/i);
    } finally {
      await admin.query('rollback');
    }
  }
  report('authenticated players and ordinary service-role writes are stopped by the first-party ownership trigger');

  const malformedGeneration = Number(formatRows[0].catalog_generation);
  let malformedError;
  try {
    await deployer.query('select content_deploy.content_sync_apply($1::bigint,$2::uuid,$3::jsonb)',
      [malformedGeneration, randomUUID(), JSON.stringify({items:[{kind:'not_allowlisted',key:'bad',owner_namespace:'first_party',format_version:1,body:{},refs:[]}]})]);
  } catch (caught) { malformedError = caught; }
  assert.ok(malformedError, 'malformed sync bundle was accepted');
  assert.match(malformedError.message, /unsupported content kind/);
  const {rows: afterMalformed} = await admin.query('select generation from public.chimera_content_catalog_state where singleton');
  assert.equal(Number(afterMalformed[0].generation), malformedGeneration, 'failed sync changed catalog generation');
  report('malformed sync is rejected atomically without a generation or deploy-log change');

  const sourceRowsNow = await loadStoredItems();
  const refs = sourceRowsNow.map((row) => ({role:'source',kind:row.content_kind,owner_namespace:row.owner_namespace,key:row.content_key,sha256:row.content_hash}));
  const generation = Number((await admin.query('select generation from public.chimera_content_catalog_state where singleton')).rows[0].generation);
  const compiledId = await publishAsAdmin(generation, 'F0a local acceptance snapshot', refs,
    {frozen_title:'F0a local acceptance snapshot', source_count:refs.length});
  const characterId = randomUUID();
  await admin.query(`
    insert into public.chimera_player_characters(id, user_id, name, world_id, state_snapshot)
    values ($1::uuid, $2::uuid, 'F0a pin fixture', null, '{}'::jsonb)
  `, [characterId, testPlayerId]);
  const pinInsert = await admin.query(`
    insert into public.chimera_game_states(player_id, story_id, compiled_story_id, player_character_id, state_initialization_version)
    values ($1::uuid,null,$2::uuid,$3::uuid,1) returning id, compiled_story_id, player_character_id
  `, [testPlayerId, compiledId, characterId]);
  const gameId = pinInsert.rows[0].id;
  assert.equal(pinInsert.rows[0].compiled_story_id, compiledId);
  assert.equal(pinInsert.rows[0].player_character_id, characterId);

  const originalTestItem = byIdentity.get('ruleset\0d100-5-pillars');
  const originalGroup = byIdentity.get('exclusion_group\0skill_system_root');
  assert.ok(originalTestItem && originalGroup, 'source edit fixture is missing');
  const modifiedItem = structuredClone(originalTestItem);
  modifiedItem.body.description_short = `${modifiedItem.body.description_short} [temporary F0a source edit]`;
  const originalBundleItems = [originalTestItem, originalGroup];
  const modifiedBundleItems = [modifiedItem, originalGroup];
  let sourceRestored = false;
  try {
    await applyLocalBundle(modifiedBundleItems);
    let staleCompileError;
    try { await publishAsAdmin(generation, 'stale catalog compile must fail', refs, {}); }
    catch (caught) { staleCompileError = caught; }
    assert.ok(staleCompileError, 'compile accepted an obsolete catalog generation');
    assert.equal(staleCompileError.code, '40001');
    const pinAfterEdit = await admin.query('select compiled_story_id from public.chimera_game_states where id=$1::uuid', [gameId]);
    assert.equal(pinAfterEdit.rows[0].compiled_story_id, compiledId, 'source edit changed a running game pin');
    const frozen = await admin.query(`
      select b.body from public.chimera_content_blobs b
      join public.chimera_compiled_content_refs r on r.sha256=b.sha256
      where r.compiled_story_id=$1::uuid and r.kind='ruleset' and r.content_key='d100-5-pillars'
    `, [compiledId]);
    assert.equal(frozen.rows.length, 1, 'compiled ruleset blob is missing');
    assert.equal(frozen.rows[0].body.body.description_short, originalTestItem.body.description_short);
    await applyLocalBundle(originalBundleItems);
    sourceRestored = true;
    report('compile reads a single generation; source edits leave the existing compiled hash and required game pin intact');
  } finally {
    if (!sourceRestored) await applyLocalBundle(originalBundleItems);
    await admin.query('delete from public.chimera_game_states where id=$1::uuid', [gameId]);
    await admin.query('delete from public.chimera_compiled_stories where id=$1::uuid', [compiledId]);
    await admin.query('delete from public.chimera_player_characters where id=$1::uuid', [characterId]);
  }

  const storyId = randomUUID();
  await admin.query(`
    insert into public.chimera_stories(id,display_name,title,owner_user_id,owner_kind,owner_namespace,content_key)
    values ($1::uuid,'F0a source-delete fixture','F0a source-delete fixture',$2::uuid,'player',$2::text,'f0a-source-delete-fixture')
  `, [storyId, testAdminId]);
  const secondCompiledId = await publishAsAdmin(
    Number((await admin.query('select generation from public.chimera_content_catalog_state where singleton')).rows[0].generation),
    'F0a source-delete snapshot', refs, {frozen_title:'F0a source-delete snapshot'});
  await admin.query('update public.chimera_compiled_stories set story_id=$1::uuid where id=$2::uuid', [storyId, secondCompiledId]);
  await admin.query('delete from public.chimera_stories where id=$1::uuid', [storyId]);
  const sourceDelete = await admin.query('select story_id, payload_blob_hash from public.chimera_compiled_stories where id=$1::uuid', [secondCompiledId]);
  assert.equal(sourceDelete.rows.length, 1, 'source-story deletion removed its frozen compile');
  assert.equal(sourceDelete.rows[0].story_id, null, 'compiled origin reference was not nulled');
  await admin.query('delete from public.chimera_compiled_stories where id=$1::uuid', [secondCompiledId]);
  report('deleting a source story leaves its frozen compiled record and blobs intact');

  const {rows: requiredPinRows} = await admin.query(`
    select a.attnotnull from pg_attribute a
    where a.attrelid='public.chimera_game_states'::regclass and a.attname='compiled_story_id' and not a.attisdropped
  `);
  assert.equal(requiredPinRows[0]?.attnotnull, true, 'compiled_story_id must be NOT NULL');
  const {rows: fkRows} = await admin.query(`
    select c.confdeltype from pg_constraint c
    where c.conrelid='public.chimera_compiled_stories'::regclass and c.conname='chimera_compiled_stories_story_id_fkey'
  `);
  assert.equal(fkRows[0]?.confdeltype, 'n', 'compiled origin FK must use ON DELETE SET NULL');
  process.stdout.write('PASS compiled session pin is database-required and source-delete cascades are removed\n');
} finally {
  await deployer.end().catch(() => undefined);
  await admin.end().catch(() => undefined);
}
