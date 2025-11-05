/**
 * OpenAPI Component Schemas
 * Phase A5: NPC Catalog schemas
 */

export const components = {
  schemas: {
    CatalogWorldMini: {
      type: 'object',
      required: ['id', 'slug', 'name'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        slug: { type: 'string' },
        name: { type: 'string' },
      },
    },
    CatalogNpc: {
      type: 'object',
      required: ['id', 'name', 'status'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        status: { type: 'string', enum: ['active', 'draft', 'archived'] },
        world: { $ref: '#/components/schemas/CatalogWorldMini', nullable: true },
        portrait_url: { type: 'string', nullable: true },
        short_desc: { type: 'string', nullable: true },
        tags: { type: 'array', items: { type: 'string' } },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
    CatalogNpcDetail: {
      allOf: [
        { $ref: '#/components/schemas/CatalogNpc' },
        {
          type: 'object',
          properties: {
            description: { type: 'string', nullable: true },
            doc: { type: 'object', additionalProperties: true, nullable: true },
          },
        },
      ],
    },
    CatalogNpcListMeta: {
      type: 'object',
      required: ['page', 'pageSize', 'total', 'hasMore', 'sort', 'order'],
      properties: {
        page: { type: 'integer', minimum: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 50 },
        total: { type: 'integer', minimum: 0 },
        hasMore: { type: 'boolean' },
        sort: { type: 'string', enum: ['name', 'created_at', 'popularity'] },
        order: { type: 'string', enum: ['asc', 'desc'] },
        q: { type: 'string' },
        world: { type: 'string' },
      },
    },
    CatalogNpcListResponse: {
      type: 'object',
      required: ['ok', 'meta', 'data'],
      properties: {
        ok: { type: 'boolean', const: true },
        meta: { $ref: '#/components/schemas/CatalogNpcListMeta' },
        data: { type: 'array', items: { $ref: '#/components/schemas/CatalogNpc' } },
      },
    },
    CatalogNpcDetailResponse: {
      oneOf: [
        {
          type: 'object',
          required: ['ok', 'data'],
          properties: {
            ok: { type: 'boolean', const: true },
            data: { $ref: '#/components/schemas/CatalogNpcDetail' },
          },
        },
        { $ref: '#/components/schemas/ApiErrorNpcNotFound' },
      ],
    },
    ApiError: {
      type: 'object',
      required: ['ok', 'code'],
      properties: {
        ok: { type: 'boolean', const: false },
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    ApiErrorInvalidParam: {
      allOf: [
        { $ref: '#/components/schemas/ApiError' },
        { type: 'object', properties: { code: { type: 'string', const: 'INVALID_PARAM' } } },
      ],
    },
    ApiErrorNpcNotFound: {
      allOf: [
        { $ref: '#/components/schemas/ApiError' },
        { type: 'object', properties: { code: { type: 'string', const: 'NPC_NOT_FOUND' } } },
      ],
    },
    ApiErrorUnauthorized: {
      allOf: [
        { $ref: '#/components/schemas/ApiError' },
        { type: 'object', properties: { code: { type: 'string', const: 'UNAUTHORIZED' } } },
      ],
    },
    ApiErrorEarlyAccessRequired: {
      allOf: [
        { $ref: '#/components/schemas/ApiError' },
        {
          type: 'object',
          properties: {
            code: { type: 'string', const: 'EARLY_ACCESS_REQUIRED' },
          },
        },
      ],
    },
    AccessRequest: {
      type: 'object',
      required: ['id', 'email', 'status', 'created_at', 'updated_at'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        user_id: { type: 'string', format: 'uuid', nullable: true },
        note: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['pending', 'approved', 'denied'] },
        reason: { type: 'string', nullable: true },
        approved_by: { type: 'string', format: 'uuid', nullable: true },
        approved_at: { type: 'string', format: 'date-time', nullable: true },
        denied_by: { type: 'string', format: 'uuid', nullable: true },
        denied_at: { type: 'string', format: 'date-time', nullable: true },
        meta: { type: 'object', additionalProperties: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  },
};


