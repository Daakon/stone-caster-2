/**
 * OpenAPI Paths for NPC Catalog
 * Phase A5: NPC list and detail endpoint documentation
 */

export const paths = {
  '/api/catalog/npcs': {
    get: {
      tags: ['Catalog', 'NPCs'],
      summary: 'List NPCs',
      description:
        'Returns public, active NPCs. RLS enforced. Supports search, world filter, pagination and sorting.',
      parameters: [
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } },
        { name: 'world', in: 'query', schema: { type: 'string' }, description: 'World id or slug' },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'pageSize',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 50, default: 24 },
        },
        {
          name: 'sort',
          in: 'query',
          schema: { type: 'string', enum: ['name', 'created_at', 'popularity'], default: 'created_at' },
        },
        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
      ],
      responses: {
        200: {
          description: 'OK',
          headers: {
            ETag: { schema: { type: 'string' }, description: 'Strong ETag for cache validation' },
            'Last-Modified': { schema: { type: 'string' }, description: 'RFC 7231 HTTP-date' },
            'Cache-Control': { schema: { type: 'string' }, description: 'Cache directives' },
            Vary: { schema: { type: 'string' }, description: 'Vary header for cache key' },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CatalogNpcListResponse' },
              examples: {
                sample: {
                  value: {
                    ok: true,
                    meta: {
                      page: 1,
                      pageSize: 24,
                      total: 137,
                      hasMore: true,
                      sort: 'created_at',
                      order: 'desc',
                      q: 'ranger',
                      world: 'mystika',
                    },
                    data: [
                      {
                        id: '11111111-1111-1111-1111-111111111111',
                        name: 'Kiera the Panther',
                        status: 'active',
                        world: { id: 'aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'mystika', name: 'Mystika' },
                        portrait_url: 'https://cdn.example.com/kiera.png',
                        short_desc: 'A lithe panther shifter...',
                        tags: ['shifter', 'stealth'],
                        created_at: '2025-10-30T15:09:22Z',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        304: {
          description: 'Not Modified',
          headers: {
            ETag: { schema: { type: 'string' } },
            'Last-Modified': { schema: { type: 'string' } },
            'Cache-Control': { schema: { type: 'string' } },
            Vary: { schema: { type: 'string' } },
          },
        },
        400: {
          description: 'Invalid parameter',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ApiErrorInvalidParam' } },
          },
        },
      },
    },
  },
  '/api/catalog/npcs/{idOrSlug}': {
    get: {
      tags: ['Catalog', 'NPCs'],
      summary: 'Get NPC detail',
      description: 'Returns NPC detail by ID (UUID) or slug. RLS enforced.',
      parameters: [
        {
          name: 'idOrSlug',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'NPC UUID or slug',
        },
      ],
      responses: {
        200: {
          description: 'OK',
          headers: {
            ETag: { schema: { type: 'string' }, description: 'Strong ETag for cache validation' },
            'Last-Modified': { schema: { type: 'string' }, description: 'RFC 7231 HTTP-date' },
            'Cache-Control': { schema: { type: 'string' }, description: 'Cache directives' },
            Vary: { schema: { type: 'string' }, description: 'Vary header for cache key' },
          },
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CatalogNpcDetailResponse' } },
          },
        },
        304: {
          description: 'Not Modified',
          headers: {
            ETag: { schema: { type: 'string' } },
            'Last-Modified': { schema: { type: 'string' } },
            'Cache-Control': { schema: { type: 'string' } },
            Vary: { schema: { type: 'string' } },
          },
        },
        404: {
          description: 'Not found or not visible (RLS)',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ApiErrorNpcNotFound' } },
          },
        },
      },
    },
  },
};


