/**
 * OpenAPI Routes
 * Phase A5: Serve OpenAPI spec and Swagger UI
 */

import { Router } from 'express';
import { openapi } from '../openapi/index.js';
import swaggerUi from 'swagger-ui-express';

export const openapiRouter = Router();

openapiRouter.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openapi);
});

openapiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));


