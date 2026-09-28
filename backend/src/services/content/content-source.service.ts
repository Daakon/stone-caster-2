import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import type { ContentFileV1, ContentKeyRef, ContentManifestV1, ContentSourceItemV1, ContentSyncBundleV1 } from '@shared/types/chimera-content.js';

const contentDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../content/first-party');
const allowedFiles = new Set([
  'rulesets.json', 'worlds.json', 'entities.json', 'lore.json', 'tags.json', 'asset-tags.json',
  'mechanics.json', 'premade-characters.json', 'localization.json', 'dialogue.json', 'quests.json', 'packs.json',
]);
const keyPattern = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const foreignIdFields = new Set(['world_id', 'entity_id', 'story_id', 'ruleset_template_id', 'ruleset_template_ids', 'tag_id', 'asset_id', 'pack_id', 'lore_id']);

export interface ValidatedContentBundle {
  manifest: ContentManifestV1;
  bundle: ContentSyncBundleV1;
  itemCount: number;
  itemHashes: Array<{kind:string; key:string; sha256:string}>;
  manifestHash: string;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left],[right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function parseJson<T>(filePath: string): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    throw new Error(`Cannot read ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'invalid JSON'}`);
  }
}

function assertNoForeignIdFields(value: unknown, location: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForeignIdFields(entry, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (foreignIdFields.has(key)) throw new Error(`${location}.${key} must use a stable content key reference`);
    assertNoForeignIdFields(entry, `${location}.${key}`);
  }
}

function assertReference(reference: ContentKeyRef, location: string): void {
  if (!reference || typeof reference !== 'object' || !keyPattern.test(reference.key) || !keyPattern.test(reference.kind)) {
    throw new Error(`${location} must contain a valid kind and stable key`);
  }
  if (reference.owner_namespace !== 'first_party') throw new Error(`${location} must specify a first_party owner namespace`);
}

export class ContentSourceService {
  loadAndValidate(): ValidatedContentBundle {
    const manifest = parseJson<ContentManifestV1>(path.join(contentDirectory, 'manifest.json'));
    if (manifest.format_version !== 1 || manifest.namespace !== 'first_party' || manifest.release_state !== 'internal') {
      throw new Error('manifest.json must declare format_version 1, first_party namespace, and internal release state');
    }
    if (!Array.isArray(manifest.files) || manifest.files.length === 0 || new Set(manifest.files).size !== manifest.files.length) {
      throw new Error('manifest.json must list unique content files');
    }
    if (manifest.files.some((file) => !allowedFiles.has(file))) throw new Error('manifest.json lists an unsupported content file');
    if ([...allowedFiles].some((file) => !manifest.files.includes(file))) throw new Error('manifest.json must list every F0a content file');

    const items: ContentSourceItemV1[] = [];
    const itemKeys = new Set<string>();
    for (const file of manifest.files) {
      const contentFile = parseJson<ContentFileV1>(path.join(contentDirectory, file));
      if (contentFile.format_version !== 1 || !Array.isArray(contentFile.items)) throw new Error(`${file} must be a version 1 content file with an items array`);
      for (const [index, item] of contentFile.items.entries()) {
        const location = `${file}.items[${index}]`;
        if (!item || !keyPattern.test(item.kind) || !keyPattern.test(item.key)) throw new Error(`${location} has an invalid kind or stable key`);
        if (!item.body || typeof item.body !== 'object' || Array.isArray(item.body)) throw new Error(`${location}.body must be a JSON object`);
        if (!Array.isArray(item.refs)) throw new Error(`${location}.refs must be an array`);
        assertNoForeignIdFields(item.body, `${location}.body`);
        item.refs.forEach((reference, refIndex) => assertReference(reference, `${location}.refs[${refIndex}]`));
        const identity = `${item.kind}\u0000first_party\u0000${item.key}`;
        if (itemKeys.has(identity)) throw new Error(`Duplicate first-party content key ${item.kind}:${item.key}`);
        itemKeys.add(identity);
        items.push(item);
      }
    }
    if (!items.length) throw new Error('Refusing an empty first-party catalog');

    for (const item of items) {
      for (const reference of item.refs) {
        const identity = `${reference.kind}\u0000${reference.owner_namespace}\u0000${reference.key}`;
        if (!itemKeys.has(identity)) throw new Error(`Dangling content reference ${item.kind}:${item.key} -> ${reference.kind}:${reference.key}`);
      }
    }

    const bundle: ContentSyncBundleV1 = {items: items.map((item) => ({...item, owner_namespace:'first_party', format_version:1}))};
    const itemHashes = bundle.items.map((item) => ({
      kind:item.kind,
      key:item.key,
      sha256:sha256(canonicalJson({format_version:item.format_version, body:item.body, refs:item.refs})),
    })).sort((left,right) => {
      const a = `${left.kind}\tfirst_party\t${left.key}`;
      const b = `${right.kind}\tfirst_party\t${right.key}`;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const manifestHash = sha256(itemHashes.map((item) => `${item.kind}\tfirst_party\t${item.key}\t${item.sha256}`).join('\n'));
    return {manifest, bundle, itemCount:items.length, itemHashes, manifestHash};
  }
}
