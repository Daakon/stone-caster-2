#!/usr/bin/env tsx

/**
 * Auto Swagger Documentation Generator
 * 
 * This script automatically generates Swagger documentation for routes
 * that don't have it yet, ensuring comprehensive API coverage.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface RouteTemplate {
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  parameters?: any[];
  requestBody?: any;
  responses: any;
}

class SwaggerDocumentationGenerator {
  private routesDir: string;
  private templates: Map<string, RouteTemplate> = new Map();

  constructor() {
    this.routesDir = join(process.cwd(), 'src', 'routes');
    this.initializeTemplates();
  }

  /**
   * Initialize common route templates
   */
  private initializeTemplates() {
    // GET routes template
    this.templates.set('GET', {
      method: 'GET',
      path: '',
      summary: 'Get resource',
      description: 'Retrieves a resource or list of resources',
      tags: ['General'],
      responses: {
        200: {
          description: 'Success',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Success' }
            }
          }
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    });

    // POST routes template
    this.templates.set('POST', {
      method: 'POST',
      path: '',
      summary: 'Create resource',
      description: 'Creates a new resource',
      tags: ['General'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                // Will be customized based on route
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Resource created successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Success' }
            }
          }
        },
        400: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    });

    // PUT routes template
    this.templates.set('PUT', {
      method: 'PUT',
      path: '',
      summary: 'Update resource',
      description: 'Updates an existing resource',
      tags: ['General'],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Resource ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                // Will be customized based on route
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Resource updated successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Success' }
            }
          }
        },
        400: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        404: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    });

    // DELETE routes template
    this.templates.set('DELETE', {
      method: 'DELETE',
      path: '',
      summary: 'Delete resource',
      description: 'Deletes a resource',
      tags: ['General'],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Resource ID'
        }
      ],
      responses: {
        200: {
          description: 'Resource deleted successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Success' }
            }
          }
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        404: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    });
  }

  /**
   * Generate Swagger documentation for a route
   */
  private generateSwaggerDoc(route: {
    method: string;
    path: string;
    file: string;
    line: number;
  }): string {
    const template = this.templates.get(route.method);
    if (!template) {
      return '';
    }

    // Determine tag based on file name
    const fileName = route.file.split('/').pop()?.replace('.ts', '') || 'General';
    const tag = this.getTagFromFileName(fileName);

    // Customize template for this route
    const doc = { ...template };
    doc.path = route.path;
    doc.tags = [tag];
    doc.summary = this.generateSummary(route);
    doc.description = this.generateDescription(route);

    // Add path parameters if route has them
    const pathParams = this.extractPathParameters(route.path);
    if (pathParams.length > 0) {
      doc.parameters = pathParams.map(param => ({
        in: 'path',
        name: param,
        required: true,
        schema: { type: 'string' },
        description: `${param} identifier`
      }));
    }

    // Add query parameters for common patterns
    if (route.path.includes('?')) {
      const queryParams = this.extractQueryParameters(route.path);
      if (!doc.parameters) doc.parameters = [];
      doc.parameters.push(...queryParams.map(param => ({
        in: 'query',
        name: param,
        required: false,
        schema: { type: 'string' },
        description: `${param} filter`
      })));
    }

    return this.formatSwaggerComment(doc);
  }

  /**
   * Get appropriate tag from file name
   */
  private getTagFromFileName(fileName: string): string {
    const tagMap: Record<string, string> = {
      'admin': 'Admin',
      'characters': 'Characters',
      'worlds': 'Worlds',
      'adventures': 'Adventures',
      'games': 'Games',
      'auth': 'Authentication',
      'profile': 'Profile',
      'content': 'Content',
      'search': 'Search',
      'stones': 'Stones',
      'subscription': 'Subscription',
      'telemetry': 'Telemetry',
      'story': 'Story',
      'dice': 'Dice',
      'webhooks': 'Webhooks',
      'debug': 'Debug',
      'player': 'Player',
      'premade-characters': 'Premade Characters',
      'players-v3': 'Players V3',
      'cookie-linking': 'Cookie Linking',
      'config': 'Configuration',
      'me': 'User Profile'
    };

    return tagMap[fileName] || fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  /**
   * Generate summary based on route
   */
  private generateSummary(route: { method: string; path: string }): string {
    const pathSegments = route.path.split('/').filter(Boolean);
    const resource = pathSegments[pathSegments.length - 1] || 'resource';
    
    switch (route.method) {
      case 'GET':
        return pathSegments.length > 1 ? `Get ${resource}` : `List ${resource}s`;
      case 'POST':
        return `Create ${resource}`;
      case 'PUT':
        return `Update ${resource}`;
      case 'DELETE':
        return `Delete ${resource}`;
      default:
        return `${route.method} ${resource}`;
    }
  }

  /**
   * Generate description based on route
   */
  private generateDescription(route: { method: string; path: string }): string {
    const pathSegments = route.path.split('/').filter(Boolean);
    const resource = pathSegments[pathSegments.length - 1] || 'resource';
    
    switch (route.method) {
      case 'GET':
        return pathSegments.length > 1 
          ? `Retrieves a specific ${resource} by ID`
          : `Retrieves a list of ${resource}s`;
      case 'POST':
        return `Creates a new ${resource}`;
      case 'PUT':
        return `Updates an existing ${resource}`;
      case 'DELETE':
        return `Deletes a ${resource}`;
      default:
        return `Performs ${route.method} operation on ${resource}`;
    }
  }

  /**
   * Extract path parameters from route path
   */
  private extractPathParameters(path: string): string[] {
    const matches = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
    return matches ? matches.map(match => match.substring(1)) : [];
  }

  /**
   * Extract query parameters from route path
   */
  private extractQueryParameters(path: string): string[] {
    const queryMatch = path.match(/\?([^#]+)/);
    if (!queryMatch) return [];
    
    return queryMatch[1].split('&').map(param => param.split('=')[0]);
  }

  /**
   * Format Swagger comment block
   */
  private formatSwaggerComment(doc: RouteTemplate): string {
    let comment = '/**\n';
    comment += ' * @swagger\n';
    comment += ` * ${doc.path}:\n`;
    comment += ` *   ${doc.method.toLowerCase()}:\n`;
    comment += ` *     summary: ${doc.summary}\n`;
    comment += ` *     description: ${doc.description}\n`;
    comment += ` *     tags: [${doc.tags.join(', ')}]\n`;
    
    if (doc.parameters && doc.parameters.length > 0) {
      comment += ' *     parameters:\n';
      doc.parameters.forEach(param => {
        comment += ` *       - in: ${param.in}\n`;
        comment += ` *         name: ${param.name}\n`;
        comment += ` *         required: ${param.required}\n`;
        comment += ` *         schema:\n`;
        comment += ` *           type: ${param.schema.type}\n`;
        if (param.schema.format) {
          comment += ` *           format: ${param.schema.format}\n`;
        }
        comment += ` *         description: ${param.description}\n`;
      });
    }
    
    if (doc.requestBody) {
      comment += ' *     requestBody:\n';
      comment += ` *       required: ${doc.requestBody.required}\n`;
      comment += ' *       content:\n';
      comment += ' *         application/json:\n';
      comment += ' *           schema:\n';
      comment += ' *             type: object\n';
      comment += ' *             properties:\n';
      comment += ' *               # Add specific properties here\n';
    }
    
    comment += ' *     responses:\n';
    Object.entries(doc.responses).forEach(([code, response]) => {
      comment += ` *       ${code}:\n`;
      comment += ` *         description: ${response.description}\n`;
    });
    
    comment += ' */\n';
    return comment;
  }

  /**
   * Process a route file and add missing documentation
   */
  async processRouteFile(filePath: string): Promise<{ added: number; skipped: number }> {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const newLines: string[] = [];
    let added = 0;
    let skipped = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a route definition
      const routeMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
      
      if (routeMatch) {
        const method = routeMatch[1].toUpperCase();
        const path = routeMatch[2];
        
        // Check if there's already Swagger documentation
        let hasSwaggerDoc = false;
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
          if (lines[j].trim().includes('@swagger')) {
            hasSwaggerDoc = true;
            break;
          }
          if (lines[j].trim().match(/router\.(get|post|put|delete|patch)/)) {
            break;
          }
        }
        
        if (!hasSwaggerDoc) {
          // Generate and add Swagger documentation
          const swaggerDoc = this.generateSwaggerDoc({
            method,
            path,
            file: filePath,
            line: i + 1
          });
          
          // Add the documentation before the route
          newLines.push(swaggerDoc);
          added++;
        } else {
          skipped++;
        }
      }
      
      newLines.push(line);
    }

    // Write the updated file
    if (added > 0) {
      writeFileSync(filePath, newLines.join('\n'));
    }

    return { added, skipped };
  }

  /**
   * Process all route files
   */
  async processAllRoutes(): Promise<void> {
    console.log('🚀 Starting automatic Swagger documentation generation...\n');
    
    const routeFiles = await glob('src/routes/*.ts', { cwd: process.cwd() });
    let totalAdded = 0;
    let totalSkipped = 0;

    for (const file of routeFiles) {
      const fullPath = join(process.cwd(), file);
      console.log(`📝 Processing ${file}...`);
      
      const result = await this.processRouteFile(fullPath);
      totalAdded += result.added;
      totalSkipped += result.skipped;
      
      if (result.added > 0) {
        console.log(`   ✅ Added ${result.added} documentation blocks`);
      }
      if (result.skipped > 0) {
        console.log(`   ⏭️  Skipped ${result.skipped} already documented routes`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   📝 Added: ${totalAdded} documentation blocks`);
    console.log(`   ⏭️  Skipped: ${totalSkipped} already documented routes`);
    console.log(`   📁 Processed: ${routeFiles.length} files`);
    
    if (totalAdded > 0) {
      console.log('\n✅ Swagger documentation generation complete!');
      console.log('💡 Remember to review and customize the generated documentation.');
    } else {
      console.log('\n🎉 All routes already have documentation!');
    }
  }
}

// Main execution
async function main() {
  const generator = new SwaggerDocumentationGenerator();
  await generator.processAllRoutes();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Documentation generation failed:', error);
    process.exit(1);
  });
}

export { SwaggerDocumentationGenerator };
