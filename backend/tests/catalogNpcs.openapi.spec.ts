/**
 * NPC Catalog OpenAPI Documentation Tests
 * Phase A5: Verify OpenAPI spec includes NPC endpoints
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { openapiRouter } from '../src/routes/openapi.js';

describe('OpenAPI Documentation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/api', openapiRouter);
  });

  it('should return 200 for /api/openapi.json', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('should include /api/catalog/npcs path', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    const spec = response.body;
    expect(spec.paths).toBeDefined();
    expect(spec.paths['/api/catalog/npcs']).toBeDefined();
    expect(spec.paths['/api/catalog/npcs'].get).toBeDefined();
  });

  it('should include /api/catalog/npcs/{idOrSlug} path', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    const spec = response.body;
    expect(spec.paths).toBeDefined();
    expect(spec.paths['/api/catalog/npcs/{idOrSlug}']).toBeDefined();
    expect(spec.paths['/api/catalog/npcs/{idOrSlug}'].get).toBeDefined();
  });

  it('should include component schemas', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    const spec = response.body;
    expect(spec.components).toBeDefined();
    expect(spec.components.schemas).toBeDefined();
    expect(spec.components.schemas.CatalogWorldMini).toBeDefined();
    expect(spec.components.schemas.CatalogNpc).toBeDefined();
    expect(spec.components.schemas.CatalogNpcDetail).toBeDefined();
    expect(spec.components.schemas.CatalogNpcListMeta).toBeDefined();
    expect(spec.components.schemas.CatalogNpcListResponse).toBeDefined();
    expect(spec.components.schemas.CatalogNpcDetailResponse).toBeDefined();
    expect(spec.components.schemas.ApiError).toBeDefined();
    expect(spec.components.schemas.ApiErrorInvalidParam).toBeDefined();
    expect(spec.components.schemas.ApiErrorNpcNotFound).toBeDefined();
  });

  it('should document ETag header in list endpoint', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    const spec = response.body;
    const listPath = spec.paths['/api/catalog/npcs'].get;
    expect(listPath.responses['200'].headers).toBeDefined();
    expect(listPath.responses['200'].headers.ETag).toBeDefined();
    expect(listPath.responses['200'].headers['Last-Modified']).toBeDefined();
    expect(listPath.responses['200'].headers['Cache-Control']).toBeDefined();
    expect(listPath.responses['200'].headers.Vary).toBeDefined();
  });

  it('should document headers in detail endpoint', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    const spec = response.body;
    const detailPath = spec.paths['/api/catalog/npcs/{idOrSlug}'].get;
    expect(detailPath.responses['200'].headers).toBeDefined();
    expect(detailPath.responses['200'].headers.ETag).toBeDefined();
    expect(detailPath.responses['200'].headers['Last-Modified']).toBeDefined();
    expect(detailPath.responses['200'].headers['Cache-Control']).toBeDefined();
    expect(detailPath.responses['200'].headers.Vary).toBeDefined();
  });

  it('should document 304 response in list endpoint', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    const spec = response.body;
    const listPath = spec.paths['/api/catalog/npcs'].get;
    expect(listPath.responses['304']).toBeDefined();
  });

  it('should document 304 response in detail endpoint', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    const spec = response.body;
    const detailPath = spec.paths['/api/catalog/npcs/{idOrSlug}'].get;
    expect(detailPath.responses['304']).toBeDefined();
  });
});


