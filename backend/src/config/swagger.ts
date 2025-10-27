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
    security: [
      {
        BearerAuth: [],
      },
      {
        GuestCookie: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API files
};

export const swaggerSpec = swaggerJsdoc(options);
