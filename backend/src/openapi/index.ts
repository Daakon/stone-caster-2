/**
 * OpenAPI Specification
 * Phase A5: Composed OpenAPI spec for NPC Catalog endpoints
 */

import { components } from './components.js';
import { paths as catalogNpcPaths } from './paths.catalogNpcs.js';
import { earlyAccessErrorPaths } from './paths.earlyAccess.js';
import { accessRequestPaths } from './paths.accessRequests.js';

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'StoneCaster API', version: '1.0.0' },
  servers: [{ url: '/' }],
  components,
  paths: { ...catalogNpcPaths, ...earlyAccessErrorPaths, ...accessRequestPaths },
};


