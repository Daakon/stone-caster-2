/**
 * OpenAPI Paths for Access Requests
 * Phase B5: Document Early Access request endpoints
 */

export const accessRequestPaths = {
  '/api/request-access': {
    post: {
      tags: ['Access Requests'],
      summary: 'Submit Early Access request',
      description: 'Public endpoint to submit an Early Access request. Rate-limited to prevent spam.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { type: 'string', format: 'email', maxLength: 254 },
                note: { type: 'string', maxLength: 500 },
                newsletter: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Request submitted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok', 'data'],
                properties: {
                  ok: { type: 'boolean', const: true },
                  data: {
                    type: 'object',
                    required: ['id', 'status'],
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      status: { type: 'string', enum: ['pending'] },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiErrorInvalidParam' },
            },
          },
        },
        429: {
          description: 'Rate limited',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok', 'code'],
                properties: {
                  ok: { type: 'boolean', const: false },
                  code: { type: 'string', const: 'RATE_LIMITED' },
                  message: { type: 'string' },
                  meta: {
                    type: 'object',
                    properties: {
                      resetIn: { type: 'integer', description: 'Seconds until rate limit resets' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/request-access/status': {
    get: {
      tags: ['Access Requests'],
      summary: 'Get request status',
      description: 'Get status of user\'s latest access request (requires authentication)',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok', 'data'],
                properties: {
                  ok: { type: 'boolean', const: true },
                  data: {
                    type: 'object',
                    properties: {
                      request: { $ref: '#/components/schemas/AccessRequest' },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiErrorUnauthorized' },
            },
          },
        },
      },
    },
  },
  '/api/admin/access-requests': {
    get: {
      tags: ['Admin', 'Access Requests'],
      summary: 'List access requests',
      description: 'Admin-only endpoint to list and filter access requests',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'denied'] } },
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Search by email' },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
        { name: 'orderBy', in: 'query', schema: { type: 'string', enum: ['created_at', 'updated_at', 'email'], default: 'created_at' } },
        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
      ],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok', 'meta', 'data'],
                properties: {
                  ok: { type: 'boolean', const: true },
                  meta: {
                    type: 'object',
                    required: ['page', 'pageSize', 'total', 'hasMore'],
                    properties: {
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      total: { type: 'integer' },
                      hasMore: { type: 'boolean' },
                      status: { type: 'string' },
                      q: { type: 'string' },
                    },
                  },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/AccessRequest' },
                  },
                },
              },
            },
          },
        },
        403: {
          description: 'Forbidden - Admin access required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
      },
    },
  },
  '/api/admin/access-requests/{id}/approve': {
    post: {
      tags: ['Admin', 'Access Requests'],
      summary: 'Approve access request',
      description: 'Approve an access request and grant Early Access role. Idempotent.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Request ID',
        },
      ],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                note: { type: 'string', maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Request approved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok', 'data'],
                properties: {
                  ok: { type: 'boolean', const: true },
                  data: {
                    type: 'object',
                    required: ['requestId'],
                    properties: {
                      requestId: { type: 'string', format: 'uuid' },
                      userId: { type: 'string', format: 'uuid', nullable: true },
                      roleUpdated: { type: 'boolean' },
                      roleVersion: { type: 'integer', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
        403: {
          description: 'Forbidden - Admin access required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
        404: {
          description: 'Request not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
      },
    },
  },
  '/api/admin/access-requests/{id}/deny': {
    post: {
      tags: ['Admin', 'Access Requests'],
      summary: 'Deny access request',
      description: 'Deny an access request with a reason. Idempotent.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Request ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: {
                reason: { type: 'string', minLength: 1, maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Request denied',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok', 'data'],
                properties: {
                  ok: { type: 'boolean', const: true },
                  data: {
                    type: 'object',
                    required: ['requestId'],
                    properties: {
                      requestId: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Validation failed (reason required)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiErrorInvalidParam' },
            },
          },
        },
        403: {
          description: 'Forbidden - Admin access required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
        404: {
          description: 'Request not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
      },
    },
  },
};

