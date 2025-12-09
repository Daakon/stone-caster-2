import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'StoneCaster API',
      version: '1.0.0',
      description: 'API for StoneCaster - Interactive Storytelling Platform',
      contact: {
        name: 'StoneCaster Team',
        email: 'support@stonecaster.ai',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.stonecaster.ai',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        GuestCookie: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Guest-Cookie-Id',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            ok: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_FAILED',
                },
                message: {
                  type: 'string',
                  example: 'Invalid request data',
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                  },
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                traceId: {
                  type: 'string',
                  example: '123e4567-e89b-12d3-a456-426614174000',
                },
              },
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            ok: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
            },
            meta: {
              type: 'object',
              properties: {
                traceId: {
                  type: 'string',
                  example: '123e4567-e89b-12d3-a456-426614174000',
                },
              },
            },
          },
        },
        Character: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            name: {
              type: 'string',
              example: 'Thorne Shifter',
            },
            worldSlug: {
              type: 'string',
              example: 'mystika',
            },
            worldData: {
              type: 'object',
              additionalProperties: true,
              example: {
                class: 'shifter_warden',
                faction_alignment: 'shifter_tribes',
                crystal_affinity: 'nature_bond',
                personality_traits: ['wild', 'protective', 'intuitive'],
              },
            },
            race: {
              type: 'string',
              example: 'Elf',
            },
            class: {
              type: 'string',
              example: 'Shifter Warden',
            },
            level: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              example: 1,
            },
            experience: {
              type: 'integer',
              minimum: 0,
              example: 0,
            },
            attributes: {
              type: 'object',
              properties: {
                strength: { type: 'integer', minimum: 1, maximum: 20 },
                dexterity: { type: 'integer', minimum: 1, maximum: 20 },
                constitution: { type: 'integer', minimum: 1, maximum: 20 },
                intelligence: { type: 'integer', minimum: 1, maximum: 20 },
                wisdom: { type: 'integer', minimum: 1, maximum: 20 },
                charisma: { type: 'integer', minimum: 1, maximum: 20 },
              },
            },
            skills: {
              type: 'array',
              items: { type: 'string' },
            },
            inventory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                },
              },
            },
            currentHealth: {
              type: 'integer',
              minimum: 0,
              example: 100,
            },
            maxHealth: {
              type: 'integer',
              minimum: 1,
              example: 100,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        PremadeCharacter: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            worldSlug: {
              type: 'string',
              example: 'mystika',
            },
            archetypeKey: {
              type: 'string',
              example: 'elven-court-guardian',
            },
            displayName: {
              type: 'string',
              example: 'Thorne Shifter',
            },
            summary: {
              type: 'string',
              example: 'A noble guardian of the elven courts...',
            },
            avatarUrl: {
              type: 'string',
              format: 'uri',
            },
            baseTraits: {
              type: 'object',
              additionalProperties: true,
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CreateCharacterRequest: {
          type: 'object',
          required: ['worldSlug'],
          properties: {
            worldSlug: {
              type: 'string',
              example: 'mystika',
            },
            name: {
              type: 'string',
              example: 'Thorne Shifter',
            },
            archetypeKey: {
              type: 'string',
              example: 'elven-court-guardian',
            },
            fromPremade: {
              type: 'boolean',
              example: true,
            },
            worldData: {
              type: 'object',
              additionalProperties: true,
              example: {
                class: 'shifter_warden',
                faction_alignment: 'shifter_tribes',
                crystal_affinity: 'nature_bond',
                personality_traits: ['wild', 'protective', 'intuitive'],
              },
            },
            race: {
              type: 'string',
              example: 'Elf',
            },
            class: {
              type: 'string',
              example: 'Shifter Warden',
            },
            level: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              example: 1,
            },
            experience: {
              type: 'integer',
              minimum: 0,
              example: 0,
            },
            attributes: {
              type: 'object',
              properties: {
                strength: { type: 'integer', minimum: 1, maximum: 20 },
                dexterity: { type: 'integer', minimum: 1, maximum: 20 },
                constitution: { type: 'integer', minimum: 1, maximum: 20 },
                intelligence: { type: 'integer', minimum: 1, maximum: 20 },
                wisdom: { type: 'integer', minimum: 1, maximum: 20 },
                charisma: { type: 'integer', minimum: 1, maximum: 20 },
              },
            },
            skills: {
              type: 'array',
              items: { type: 'string' },
            },
            inventory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                },
              },
            },
            currentHealth: {
              type: 'integer',
              minimum: 0,
              example: 100,
            },
            maxHealth: {
              type: 'integer',
              minimum: 1,
              example: 100,
            },
          },
        },
        CookieLinkRequest: {
          type: 'object',
          required: ['cookieId'],
          properties: {
            cookieId: {
              type: 'string',
              format: 'uuid',
              description: 'The guest cookie ID to link to the authenticated user',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
        CookieLinkResponse: {
          type: 'object',
          properties: {
            linked: {
              type: 'boolean',
              example: true,
            },
            charactersMigrated: {
              type: 'integer',
              description: 'Number of characters migrated from cookie to user',
              example: 3,
            },
          },
        },
        CookieLinkCheckResponse: {
          type: 'object',
          properties: {
            isLinked: {
              type: 'boolean',
              example: true,
            },
            userId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
        Prompt: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            layer: {
              type: 'string',
              enum: ['core', 'world', 'adventure', 'entry', 'npc'],
              example: 'world',
            },
            content: {
              type: 'string',
              example: 'You are a fantasy world with magical crystals...',
            },
            world_slug: {
              type: 'string',
              nullable: true,
              example: 'mystika',
            },
            adventure_slug: {
              type: 'string',
              nullable: true,
              example: 'the-crystal-quest',
            },
            metadata: {
              type: 'object',
              additionalProperties: true,
              example: { version: '1.0', tags: ['magic', 'crystals'] },
            },
            sort_order: {
              type: 'integer',
              example: 1,
            },
            active: {
              type: 'boolean',
              example: true,
            },
            locked: {
              type: 'boolean',
              example: false,
            },
            tokenCount: {
              type: 'integer',
              description: 'Estimated token count for the content',
              example: 150,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CreatePromptRequest: {
          type: 'object',
          required: ['layer', 'content'],
          properties: {
            layer: {
              type: 'string',
              enum: ['core', 'world', 'adventure', 'entry', 'npc'],
              example: 'world',
            },
            content: {
              type: 'string',
              example: 'You are a fantasy world with magical crystals...',
            },
            world_slug: {
              type: 'string',
              nullable: true,
              example: 'mystika',
            },
            adventure_slug: {
              type: 'string',
              nullable: true,
              example: 'the-crystal-quest',
            },
            metadata: {
              type: 'object',
              additionalProperties: true,
              example: { version: '1.0', tags: ['magic', 'crystals'] },
            },
            sort_order: {
              type: 'integer',
              example: 1,
            },
            active: {
              type: 'boolean',
              default: true,
              example: true,
            },
            locked: {
              type: 'boolean',
              default: false,
              example: false,
            },
          },
        },
      },
    },
    paths: {
      '/api/catalog/worlds': {
        get: {
          summary: 'List worlds (active only)',
          tags: ['Catalog'],
          parameters: [
            { in: 'query', name: 'q', schema: { type: 'string' } },
            { in: 'query', name: 'activeOnly', schema: { type: 'integer', enum: [0, 1] }, example: 1 },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/catalog/stories': {
        get: {
          summary: 'List stories (active only)',
          tags: ['Catalog'],
          parameters: [
            { in: 'query', name: 'q', schema: { type: 'string' } },
            { in: 'query', name: 'world', schema: { type: 'string' } },
            { in: 'query', name: 'kind', schema: { type: 'string', enum: ['scenario', 'adventure'] } },
            { in: 'query', name: 'ruleset', schema: { type: 'string' } },
            { in: 'query', name: 'tags', schema: { type: 'array', items: { type: 'string' } } },
            { in: 'query', name: 'activeOnly', schema: { type: 'integer', enum: [0, 1] }, example: 1 },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/catalog/npcs': {
        get: {
          summary: 'List NPCs (active only)',
          tags: ['Catalog'],
          parameters: [
            { in: 'query', name: 'q', schema: { type: 'string' } },
            { in: 'query', name: 'world', schema: { type: 'string' } },
            { in: 'query', name: 'activeOnly', schema: { type: 'integer', enum: [0, 1] }, example: 1 },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/catalog/rulesets': {
        get: {
          summary: 'List rulesets (active only)',
          tags: ['Catalog'],
          parameters: [
            { in: 'query', name: 'q', schema: { type: 'string' } },
            { in: 'query', name: 'activeOnly', schema: { type: 'integer', enum: [0, 1] }, example: 1 },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/catalog/worlds/{idOrSlug}': {
        get: {
          summary: 'Get world by id or slug',
          tags: ['Catalog'],
          parameters: [{ in: 'path', name: 'idOrSlug', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
      },
      '/api/catalog/stories/{idOrSlug}': {
        get: {
          summary: 'Get story by id or slug',
          tags: ['Catalog'],
          parameters: [{ in: 'path', name: 'idOrSlug', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
      },
      '/api/catalog/npcs/{id}': {
        get: {
          summary: 'Get NPC by id',
          tags: ['Catalog'],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
      },
      '/api/catalog/rulesets/{id}': {
        get: {
          summary: 'Get ruleset by id',
          tags: ['Catalog'],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
      },
      '/api/catalog/entry-points': {
        get: {
          summary: 'List entry points (active only)',
          tags: ['Catalog'],
          parameters: [
            { in: 'query', name: 'q', schema: { type: 'string' } },
            { in: 'query', name: 'world', schema: { type: 'string' } },
            { in: 'query', name: 'kind', schema: { type: 'string', enum: ['scenario', 'adventure'] } },
            { in: 'query', name: 'ruleset', schema: { type: 'string' } },
            { in: 'query', name: 'tags', schema: { type: 'array', items: { type: 'string' } } },
            { in: 'query', name: 'activeOnly', schema: { type: 'integer', enum: [0, 1] }, example: 1 },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/catalog/entry-points/{idOrSlug}': {
        get: {
          summary: 'Get entry point by id or slug',
          tags: ['Catalog'],
          parameters: [{ in: 'path', name: 'idOrSlug', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
      },
      '/api/auth/guest': {
        post: {
          summary: 'Create/refresh guest token',
          tags: ['Auth'],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/me/characters': {
        get: { summary: 'List my characters', tags: ['Characters'], security: [{ BearerAuth: [] }], responses: { '200': { description: 'OK' } } },
        post: { summary: 'Create character', tags: ['Characters'], security: [{ BearerAuth: [] }], requestBody: { required: true }, responses: { '201': { description: 'Created' } } },
      },
      '/api/sessions': {
        get: {
          summary: 'Find existing session (resume)',
          tags: ['Sessions'],
          parameters: [
            { in: 'query', name: 'story_id', schema: { type: 'string', format: 'uuid' } },
            { in: 'query', name: 'character_id', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create session (idempotent)',
          tags: ['Sessions'],
          parameters: [
            { in: 'header', name: 'Idempotency-Key', required: false, schema: { type: 'string' } },
          ],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' }, '409': { description: 'Conflict (existing session)' } },
        },
      },
      '/api/sessions/{id}': {
        get: {
          summary: 'Get session by id',
          tags: ['Sessions'],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
      },
      '/api/sessions/{id}/messages': {
        get: {
          summary: 'List session messages',
          tags: ['Sessions'],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
            { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 }, example: 20 },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Auth endpoints
      '/api/auth/magic/start': {
        post: {
          summary: 'Start Magic Link authentication',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/auth/magic/verify': {
        post: {
          summary: 'Verify Magic Link token',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'token', 'guestCookieId'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    token: { type: 'string' },
                    guestCookieId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/auth/oauth/{provider}/start': {
        get: {
          summary: 'Start OAuth flow',
          tags: ['Auth'],
          parameters: [
            { in: 'path', name: 'provider', required: true, schema: { type: 'string', enum: ['google', 'github', 'discord'] } },
            { in: 'query', name: 'guestCookieId', schema: { type: 'string', format: 'uuid' } },
            { in: 'query', name: 'destination', schema: { type: 'string', enum: ['web', 'api'] } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/auth/oauth/{provider}/callback': {
        get: {
          summary: 'Handle OAuth callback',
          tags: ['Auth'],
          parameters: [
            { in: 'path', name: 'provider', required: true, schema: { type: 'string', enum: ['google', 'github', 'discord'] } },
            { in: 'query', name: 'code', required: true, schema: { type: 'string' } },
            { in: 'query', name: 'state', required: true, schema: { type: 'string' } },
          ],
          responses: { '302': { description: 'Redirect' } },
        },
      },
      '/api/auth/logout': {
        post: {
          summary: 'Sign out user',
          tags: ['Auth'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Me endpoints
      '/api/me': {
        get: {
          summary: 'Get current user info',
          tags: ['Me'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Profile endpoints
      '/api/profile': {
        get: {
          summary: 'Get current user profile',
          tags: ['Profile'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
        put: {
          summary: 'Update current user profile',
          tags: ['Profile'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/profile/access': {
        get: {
          summary: 'Check profile access',
          tags: ['Profile'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/profile/revoke-sessions': {
        post: {
          summary: 'Revoke other sessions',
          tags: ['Profile'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['csrfToken'],
                  properties: {
                    csrfToken: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/profile/csrf-token': {
        post: {
          summary: 'Generate CSRF token',
          tags: ['Profile'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/profile/guest/{cookieId}': {
        get: {
          summary: 'Get guest profile by cookie ID',
          tags: ['Profile'],
          parameters: [
            { in: 'path', name: 'cookieId', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/profile/guest': {
        post: {
          summary: 'Create guest profile',
          tags: ['Profile'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['cookieId'],
                  properties: {
                    cookieId: { type: 'string' },
                    deviceLabel: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/profile/guest-summary/{cookieGroupId}': {
        get: {
          summary: 'Get guest account summary',
          tags: ['Profile'],
          parameters: [
            { in: 'path', name: 'cookieGroupId', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/profile/link-guest': {
        post: {
          summary: 'Link guest account to authenticated user',
          tags: ['Profile'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['cookieGroupId'],
                  properties: {
                    cookieGroupId: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      // Health endpoints
      '/api/health/ready': {
        get: {
          summary: 'Readiness check',
          tags: ['Health'],
          responses: { '200': { description: 'OK' }, '503': { description: 'Not Ready' } },
        },
      },
      '/api/health/live': {
        get: {
          summary: 'Liveness check',
          tags: ['Health'],
          responses: { '200': { description: 'OK' } },
        },
      },
      // System endpoints
      '/api/system/roles': {
        get: {
          summary: 'List user roles',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'role', schema: { type: 'string', enum: ['creator', 'moderator', 'admin'] } },
            { in: 'query', name: 'q', schema: { type: 'string' } },
            { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { in: 'query', name: 'cursor', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/roles/stats': {
        get: {
          summary: 'Get role statistics',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/roles/{id}/assign': {
        post: {
          summary: 'Assign role to user',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['role'],
                  properties: {
                    role: { type: 'string', enum: ['creator', 'moderator', 'admin'] },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/roles/{id}/remove': {
        post: {
          summary: 'Remove role from user',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['role'],
                  properties: {
                    role: { type: 'string', enum: ['creator', 'moderator', 'admin'] },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/roles/{id}/toggle-verified': {
        post: {
          summary: 'Toggle verified creator status',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['is_verified'],
                  properties: {
                    is_verified: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/roles/search': {
        get: {
          summary: 'Search users by email or ID',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'q', required: true, schema: { type: 'string', minLength: 2 } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Access Requests
      '/api/request-access': {
        post: {
          summary: 'Submit Early Access request',
          tags: ['Access Requests'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    note: { type: 'string' },
                    newsletter: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' }, '429': { description: 'Rate Limited' } },
        },
      },
      '/api/request-access/status': {
        get: {
          summary: 'Get access request status',
          tags: ['Access Requests'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/admin/access-requests': {
        get: {
          summary: 'List access requests (admin)',
          tags: ['Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending', 'approved', 'denied'] } },
            { in: 'query', name: 'q', schema: { type: 'string' } },
            { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { in: 'query', name: 'orderBy', schema: { type: 'string' } },
            { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/admin/access-requests/{id}/approve': {
        post: {
          summary: 'Approve access request (admin)',
          tags: ['Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    note: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/admin/access-requests/{id}/deny': {
        post: {
          summary: 'Deny access request (admin)',
          tags: ['Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  properties: {
                    reason: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      // Internal Flags
      '/api/internal/flags': {
        get: {
          summary: 'Get feature flags (admin)',
          tags: ['Internal'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Chimera API endpoints
      '/api/chimera/worlds': {
        get: {
          summary: 'List all worlds',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create a new world',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/chimera/worlds/{id}': {
        get: {
          summary: 'Get world by ID',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update world',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/chimera/rulesets': {
        get: {
          summary: 'List rulesets',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          parameters: [
            { in: 'query', name: 'category', schema: { type: 'string', enum: ['foundation', 'expansion', 'flavor'] } },
          ],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create a new ruleset',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/chimera/rulesets/{id}': {
        get: {
          summary: 'Get ruleset by ID or key',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update ruleset',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/chimera/entities': {
        get: {
          summary: 'List all entities',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create a new entity',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/chimera/entities/{id}': {
        get: {
          summary: 'Get entity by ID',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update entity',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete entity',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/chimera/lore': {
        get: {
          summary: 'List all lore fragments',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create a new lore fragment',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/chimera/lore/{id}': {
        get: {
          summary: 'Get lore fragment by ID',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }, { GuestCookie: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update lore fragment',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete lore fragment',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/chimera/assets/upload-url': {
        post: {
          summary: 'Generate asset upload URL',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['contentType', 'folder'],
                  properties: {
                    contentType: { type: 'string' },
                    folder: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/chimera/assets/sign-upload': {
        post: {
          summary: 'Generate signed upload URL (alias)',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    filename: { type: 'string' },
                    fileType: { type: 'string' },
                    contentType: { type: 'string' },
                    folder: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/chimera/compile': {
        post: {
          summary: 'Compile a story from world, rulesets, and entities',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['worldId', 'rulesetIds'],
                  properties: {
                    worldId: { type: 'string', format: 'uuid' },
                    rulesetIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
                    entityIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/chimera/play/{gameStateId}': {
        get: {
          summary: 'Get current game state',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'gameStateId', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
      },
      '/api/chimera/play/{gameStateId}/cast': {
        post: {
          summary: 'Execute game loop (cast stone)',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'gameStateId', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userText'],
                  properties: {
                    userText: { type: 'string', minLength: 1 },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/chimera/play/start': {
        post: {
          summary: 'Initialize a new game session',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['compiledStoryId'],
                  properties: {
                    compiledStoryId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/chimera/game/init': {
        post: {
          summary: 'Initialize a new game with player character data',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['storyId', 'playerInput'],
                  properties: {
                    storyId: { type: 'string', format: 'uuid' },
                    playerInput: {
                      type: 'object',
                      required: ['identity'],
                      properties: {
                        identity: {
                          type: 'object',
                          required: ['name'],
                          properties: {
                            name: { type: 'string' },
                            pronouns: { type: 'string' },
                            role: { type: 'string' },
                            age: { type: 'number' },
                          },
                        },
                        appearance: { type: 'object' },
                        backstory: { type: 'string' },
                        personality_traits: { type: 'array', items: { type: 'string' } },
                        drive: { type: 'string' },
                        flaw: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/chimera/game/stories/{id}': {
        get: {
          summary: 'Get compiled story by ID',
          tags: ['Chimera'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
      },
      // Chimera V2 endpoints
      '/api/v2/chimera/health': {
        get: {
          summary: 'Chimera V2 health check',
          tags: ['Chimera V2'],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/profile': {
        put: {
          summary: 'Update Chimera profile',
          tags: ['Chimera V2'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      // Chimera V2 Worlds endpoints
      '/api/v2/chimera/worlds': {
        post: {
          summary: 'Create a new world',
          tags: ['Chimera V2 Worlds'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/v2/chimera/worlds/selectable': {
        get: {
          summary: 'Get selectable worlds',
          tags: ['Chimera V2 Worlds'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/worlds/my-creations': {
        get: {
          summary: 'Get my created worlds',
          tags: ['Chimera V2 Worlds'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/worlds/pending': {
        get: {
          summary: 'Get pending worlds',
          tags: ['Chimera V2 Worlds'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/worlds/{id}': {
        get: {
          summary: 'Get world by ID',
          tags: ['Chimera V2 Worlds'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update world',
          tags: ['Chimera V2 Worlds'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete world',
          tags: ['Chimera V2 Worlds'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/worlds/{id}/rulesets': {
        get: {
          summary: 'Get world rulesets',
          tags: ['Chimera V2 Worlds'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Chimera V2 Stories endpoints
      '/api/v2/chimera/stories': {
        post: {
          summary: 'Create a new story',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/v2/chimera/stories/my-creations': {
        get: {
          summary: 'Get my created stories',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/stories/{id}': {
        get: {
          summary: 'Get story by ID',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update story',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete story',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/stories/{id}/rebuild': {
        post: {
          summary: 'Rebuild story',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/stories/{id}/definition': {
        put: {
          summary: 'Update story definition',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/stories/{id}/links/entities': {
        post: {
          summary: 'Link entity to story',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/stories/{id}/links/entities/{entity_id}': {
        delete: {
          summary: 'Unlink entity from story',
          tags: ['Chimera V2 Stories'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
            { in: 'path', name: 'entity_id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Chimera V2 Entities endpoints
      '/api/v2/chimera/entities': {
        get: {
          summary: 'List all entities',
          tags: ['Chimera V2 Entities'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create a new entity',
          tags: ['Chimera V2 Entities'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/v2/chimera/entities/selectable': {
        get: {
          summary: 'Get selectable entities',
          tags: ['Chimera V2 Entities'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/entities/pending': {
        get: {
          summary: 'Get pending entities',
          tags: ['Chimera V2 Entities'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/entities/my-creations': {
        get: {
          summary: 'Get my created entities',
          tags: ['Chimera V2 Entities'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/entities/{id}': {
        get: {
          summary: 'Get entity by ID',
          tags: ['Chimera V2 Entities'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update entity',
          tags: ['Chimera V2 Entities'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete entity',
          tags: ['Chimera V2 Entities'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Chimera V2 Lore endpoints
      '/api/v2/chimera/lore': {
        get: {
          summary: 'List all lore entries',
          tags: ['Chimera V2 Lore'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'world_id', schema: { type: 'string', format: 'uuid' } },
            { in: 'query', name: 'story_id', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create a new lore entry',
          tags: ['Chimera V2 Lore'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/v2/chimera/lore/my-creations': {
        get: {
          summary: 'Get my created lore entries',
          tags: ['Chimera V2 Lore'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/lore/tags': {
        get: {
          summary: 'Get lore tags',
          tags: ['Chimera V2 Lore'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/lore/{id}': {
        get: {
          summary: 'Get lore entry by ID',
          tags: ['Chimera V2 Lore'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update lore entry',
          tags: ['Chimera V2 Lore'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete lore entry',
          tags: ['Chimera V2 Lore'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Chimera V2 Packs endpoints
      '/api/v2/chimera/packs': {
        post: {
          summary: 'Create a new content pack',
          tags: ['Chimera V2 Content Packs'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/v2/chimera/packs/selectable': {
        get: {
          summary: 'Get selectable packs',
          tags: ['Chimera V2 Content Packs'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'exclude', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/packs/my-creations': {
        get: {
          summary: 'Get my created packs',
          tags: ['Chimera V2 Content Packs'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/packs/{id}': {
        get: {
          summary: 'Get pack by ID',
          tags: ['Chimera V2 Content Packs'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update pack',
          tags: ['Chimera V2 Content Packs'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete pack',
          tags: ['Chimera V2 Content Packs'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/packs/{id}/rulesets': {
        get: {
          summary: 'Get pack rulesets',
          tags: ['Chimera V2 Content Packs'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Admin endpoints
      '/api/admin/metrics': {
        get: {
          summary: 'Get current metrics snapshot (admin)',
          tags: ['Admin'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/admin/metrics/route/{route}': {
        get: {
          summary: 'Get detailed metrics for a specific route (admin)',
          tags: ['Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'route', required: true, schema: { type: 'string' } },
            { in: 'query', name: 'method', schema: { type: 'string', default: 'GET' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/admin/metrics/error/{errorCode}': {
        get: {
          summary: 'Get detailed metrics for a specific error code (admin)',
          tags: ['Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'errorCode', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/admin/metrics/reset': {
        post: {
          summary: 'Reset all metrics (admin)',
          tags: ['Admin'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/telemetry/summary': {
        get: {
          summary: 'Get aggregated telemetry summary (admin)',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
            { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
            { in: 'query', name: 'storyId', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/telemetry/timeseries': {
        get: {
          summary: 'Get timeseries data for a metric (admin)',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'metric', schema: { type: 'string', enum: ['tokens_after', 'latency_ms'] } },
            { in: 'query', name: 'bucket', schema: { type: 'string', enum: ['hour', 'day'] } },
            { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
            { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
            { in: 'query', name: 'storyId', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/budget': {
        get: {
          summary: 'Get Chimera table statistics (admin)',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/admin/prompt-budget-report': {
        post: {
          summary: 'Generate budget report (admin)',
          tags: ['Admin'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/system/templates/health': {
        get: {
          summary: 'Get templates health check (admin)',
          tags: ['System'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      // Chimera V2 Admin endpoints
      '/api/v2/chimera/admin/rulesets': {
        get: {
          summary: 'Get all ruleset templates (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create a new ruleset template (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/rulesets/exclusion-groups': {
        get: {
          summary: 'Get all exclusion groups (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/rulesets/{id}': {
        get: {
          summary: 'Get ruleset template by ID or key (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update ruleset template (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete ruleset template (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/tags': {
        get: {
          summary: 'Get all tags (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create a new tag (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tag_name'],
                  properties: {
                    tag_name: { type: 'string', minLength: 1, maxLength: 100 },
                    is_approved: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/tags/{id}': {
        put: {
          summary: 'Update a tag (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tag_name: { type: 'string', minLength: 1, maxLength: 100 },
                    is_approved: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete a tag (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/entities': {
        post: {
          summary: 'Create a system entity (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/entities/{id}': {
        put: {
          summary: 'Update a system entity (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete a system entity (admin)',
          tags: ['Chimera V2 Admin'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/worlds': {
        get: {
          summary: 'List all official worlds (admin)',
          tags: ['Admin Chimera Worlds'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create an official world (admin)',
          tags: ['Admin Chimera Worlds'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/worlds/{id}': {
        put: {
          summary: 'Update an official world (admin)',
          tags: ['Admin Chimera Worlds'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete an official world (admin)',
          tags: ['Admin Chimera Worlds'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/entities-official': {
        get: {
          summary: 'List all official entities (admin)',
          tags: ['Admin Chimera Entities'],
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Create an official entity (admin)',
          tags: ['Admin Chimera Entities'],
          security: [{ BearerAuth: [] }],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v2/chimera/admin/entities-official/{id}': {
        get: {
          summary: 'Get an official entity by ID (admin)',
          tags: ['Admin Chimera Entities'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } },
        },
        put: {
          summary: 'Update an official entity (admin)',
          tags: ['Admin Chimera Entities'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: { required: true },
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          summary: 'Delete an official entity (admin)',
          tags: ['Admin Chimera Entities'],
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
      {
        GuestCookie: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
  ], // Path to the API files
  // Note: admin.ts is included but has commented-out JSDoc that may cause YAML parsing warnings
  // These warnings are non-fatal and can be ignored
};

export const swaggerSpec = swaggerJsdoc(options);
