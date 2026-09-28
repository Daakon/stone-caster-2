import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const envFile = path.join(root, 'backend/.env');
const env = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : process.env;
const baseUrl = (env.HOSTED_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/$/, '');
const token = env.HOSTED_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;
if (!baseUrl || !token) throw new Error('HOSTED_SUPABASE_URL and a read-only audit credential are required.');
const host = new URL(baseUrl).hostname;
if (/localhost|127\.0\.0\.1|\[::1\]/i.test(host)) throw new Error('Hosted reconciliation audit requires the hosted project URL.');

async function readAll(table:string, fields='*'):Promise<Record<string, any>[]> {
  const rows:Record<string, any>[] = [];
  for (let from=0;;from+=500) {
    const url = new URL(`${baseUrl}/rest/v1/${table}`);
    url.searchParams.set('select',fields);
    const response = await fetch(url, {method:'GET',headers:{apikey:token,Authorization:`Bearer ${token}`,Range:`${from}-${from+499}`,Prefer:'count=exact'}});
    if (!response.ok) throw new Error(`GET ${table} returned HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`GET ${table} returned a non-array response`);
    rows.push(...page);
    if (page.length<500) return rows;
  }
}
const contentBytes = (row:Record<string, unknown>) => Buffer.byteLength(JSON.stringify(Object.fromEntries(Object.entries(row)
  .filter(([key])=>!['id','created_at','updated_at','owner_id','owner_user_id','world_id','is_official','visibility'].includes(key)))), 'utf8');
const cell = (value:unknown) => String(value ?? 'n/a').replace(/[\r\n|]/g,' ');
const [worlds,entities,lore,premades,profiles,appRoles] = await Promise.all([
  readAll('chimera_worlds'),readAll('chimera_entities'),readAll('chimera_lore'),readAll('premade_characters'),
  readAll('profiles','id,role').catch(()=>[]),readAll('app_roles','user_id,role').catch(()=>[]),
]);
const roleMap = new Map<string,string>();
for (const row of profiles) if (row.id) roleMap.set(String(row.id),String(row.role ?? 'unknown'));
for (const row of appRoles) if (row.user_id) roleMap.set(String(row.user_id),[...new Set([...(roleMap.get(String(row.user_id)) ?? '').split(',').filter(Boolean),String(row.role ?? 'unknown')])].sort().join(','));
const worldIdMap = new Map(worlds.map((world)=>[String(world.id),String(world.key ?? world.slug ?? `id:${world.id}`)]));
const ownerInfo = (row:Record<string, any>) => {
  const id = row.owner_user_id ?? row.owner_id ?? null;
  return {id,role:id ? (roleMap.get(String(id)) ?? 'no profile role found') : 'SQL NULL'};
};
const lines = [
  `host=${host}`,
  `retrieved_at_utc=${new Date().toISOString()}`,
  `counts=worlds:${worlds.length},entities:${entities.length},lore:${lore.length},premade_characters:${premades.length}`,
  '',
  '| kind | key / slug / row id | visibility | official | owner | owner role | approx bytes | world |',
  '|---|---|---|---|---|---|---:|---|',
];
function addRow(kind:string,row:Record<string, any>,key:string,world:string) {
  const owner=ownerInfo(row);
  lines.push(`| ${kind} | ${cell(key)} | ${cell(row.visibility)} | ${cell(row.is_official)} | ${cell(owner.id)} | ${cell(owner.role)} | ${contentBytes(row)} | ${cell(world)} |`);
}
for (const row of worlds) addRow('world',row,row.key ?? row.slug ?? `id:${row.id}`,'n/a');
for (const row of entities) addRow('entity',row,row.key ?? row.slug ?? `id:${row.id}`,row.world_id ? (worldIdMap.get(String(row.world_id)) ?? `unmatched:${row.world_id}`) : 'n/a');
for (const row of lore) {
  const title=row.fragment?.display_name ?? row.fragment?.title ?? row.fragment?.name ?? 'no display title';
  addRow('lore',row,`${row.key ?? row.slug ?? `id:${row.id}`}; ${title}`,row.world_id ? (worldIdMap.get(String(row.world_id)) ?? `unmatched:${row.world_id}`) : 'n/a');
}
for (const row of premades) addRow('premade',row,row.archetype_key ?? row.key ?? `id:${row.id}`,`world_slug=${row.world_slug ?? 'n/a'}; world_id=${row.world_id ?? 'n/a'}`);
const absentWorlds = ['veloria','whispercross','aetherium','noctis-veil','paragon-city'].filter((key)=>!worlds.some((row)=>row.key===key || row.slug===key));
lines.push('',`world_key_checks=${['veloria','whispercross','aetherium','noctis-veil','paragon-city'].map((key)=>`${key}:${absentWorlds.includes(key)?'absent':'present'}`).join(',')}`);
process.stdout.write(`${lines.join('\n')}\n`);
