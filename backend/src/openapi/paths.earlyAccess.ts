/**
 * OpenAPI Paths for Early Access Error Responses
 * Phase B4: Document Early Access error codes for protected routes
 */

export const earlyAccessErrorPaths = {
  '/api/games/health': {
    get: {
      tags: ['Games', 'Health'],
      summary: 'Protected health check',
      description: 'Health check endpoint protected by Early Access guard. Returns 401/403 if access denied.',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean', const: true },
                  data: {
                    type: 'object',
                    properties: {
                      up: { type: 'boolean' },
                      service: { type: 'string' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized - Sign in required',
          headers: {
            'WWW-Authenticate': {
              schema: { type: 'string' },
              description: 'Bearer realm="StoneCaster API"',
            },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiErrorUnauthorized' },
            },
          },
        },
        403: {
          description: 'Forbidden - Early access approval required',
          headers: {
            'x-reason': {
              schema: { type: 'string', const: 'EARLY_ACCESS_REQUIRED' },
              description: 'Reason for denial',
            },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiErrorEarlyAccessRequired' },
            },
          },
        },
      },
    },
  },
};

