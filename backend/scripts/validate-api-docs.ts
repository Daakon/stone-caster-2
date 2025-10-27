#!/usr/bin/env tsx

/**
 * API Documentation Validation Script
 * 
 * This script ensures that all API routes are properly documented in Swagger
 * and serves as a source of truth for API structure validation.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface RouteInfo {
  method: string;
  path: string;
  file: string;
  line: number;
  hasSwaggerDoc: boolean;
  swaggerTag?: string;
}

interface ValidationResult {
  totalRoutes: number;
  documentedRoutes: number;
  undocumentedRoutes: RouteInfo[];
  missingTags: RouteInfo[];
  errors: string[];
}

class APIDocumentationValidator {
  private routesDir: string;
  private results: ValidationResult;

  constructor() {
    this.routesDir = join(process.cwd(), 'src', 'routes');
    this.results = {
      totalRoutes: 0,
      documentedRoutes: 0,
      undocumentedRoutes: [],
      missingTags: [],
      errors: []
    };
  }

  /**
   * Extract route information from TypeScript files
   */
  private extractRouteInfo(filePath: string): RouteInfo[] {
    const content = readFileSync(filePath, 'utf-8');
    const routes: RouteInfo[] = [];
    
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match router method calls (get, post, put, delete, patch)
      const routeMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
      
      if (routeMatch) {
        const method = routeMatch[1].toUpperCase();
        const path = routeMatch[2];
        
        // Check if there's Swagger documentation above this route
        let hasSwaggerDoc = false;
        let swaggerTag: string | undefined;
        
        // Look backwards for @swagger comment
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
          const prevLine = lines[j].trim();
          
          if (prevLine.includes('@swagger')) {
            hasSwaggerDoc = true;
            
            // Extract tag from swagger comment
            const tagMatch = prevLine.match(/tags:\s*\[([^\]]+)\]/);
            if (tagMatch) {
              swaggerTag = tagMatch[1].replace(/['"]/g, '');
            }
            break;
          }
          
          // Stop if we hit another route definition
          if (prevLine.match(/router\.(get|post|put|delete|patch)/)) {
            break;
          }
        }
        
        routes.push({
          method,
          path,
          file: filePath,
          line: i + 1,
          hasSwaggerDoc,
          swaggerTag
        });
      }
    }
    
    return routes;
  }

  /**
   * Validate all route files
   */
  async validateAllRoutes(): Promise<ValidationResult> {
    try {
      // Find all TypeScript route files
      const routeFiles = await glob('src/routes/*.ts', { cwd: process.cwd() });
      
      console.log(`🔍 Found ${routeFiles.length} route files to validate...`);
      
      for (const file of routeFiles) {
        const fullPath = join(process.cwd(), file);
        const routes = this.extractRouteInfo(fullPath);
        
        for (const route of routes) {
          this.results.totalRoutes++;
          
          if (route.hasSwaggerDoc) {
            this.results.documentedRoutes++;
            
            // Check if route has proper tags
            if (!route.swaggerTag) {
              this.results.missingTags.push(route);
            }
          } else {
            this.results.undocumentedRoutes.push(route);
          }
        }
      }
      
      return this.results;
    } catch (error) {
      this.results.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.results;
    }
  }

  /**
   * Generate a detailed report
   */
  generateReport(): string {
    const { totalRoutes, documentedRoutes, undocumentedRoutes, missingTags, errors } = this.results;
    
    let report = '\n📊 API Documentation Validation Report\n';
    report += '=' .repeat(50) + '\n\n';
    
    // Summary
    const documentationPercentage = totalRoutes > 0 ? Math.round((documentedRoutes / totalRoutes) * 100) : 0;
    report += `📈 Documentation Coverage: ${documentedRoutes}/${totalRoutes} (${documentationPercentage}%)\n\n`;
    
    // Errors
    if (errors.length > 0) {
      report += '❌ Errors:\n';
      errors.forEach(error => report += `   • ${error}\n`);
      report += '\n';
    }
    
    // Undocumented routes
    if (undocumentedRoutes.length > 0) {
      report += '⚠️  Undocumented Routes:\n';
      undocumentedRoutes.forEach(route => {
        report += `   • ${route.method} ${route.path} (${route.file}:${route.line})\n`;
      });
      report += '\n';
    }
    
    // Missing tags
    if (missingTags.length > 0) {
      report += '🏷️  Routes Missing Tags:\n';
      missingTags.forEach(route => {
        report += `   • ${route.method} ${route.path} (${route.file}:${route.line})\n`;
      });
      report += '\n';
    }
    
    // Recommendations
    if (undocumentedRoutes.length > 0 || missingTags.length > 0) {
      report += '💡 Recommendations:\n';
      report += '   1. Add @swagger comments above all route handlers\n';
      report += '   2. Include proper tags for route categorization\n';
      report += '   3. Document request/response schemas\n';
      report += '   4. Add example requests and responses\n';
      report += '   5. Run this script regularly to maintain documentation\n\n';
    }
    
    // Success message
    if (undocumentedRoutes.length === 0 && missingTags.length === 0 && errors.length === 0) {
      report += '✅ All routes are properly documented!\n';
      report += '🎉 Your API documentation is up-to-date and complete.\n\n';
    }
    
    return report;
  }

  /**
   * Generate Swagger schema validation
   */
  async validateSwaggerSchema(): Promise<boolean> {
    try {
      const { swaggerSpec } = await import('../dist/config/swagger.js');
      
      // Basic validation checks
      if (!swaggerSpec.info) {
        this.results.errors.push('Swagger spec missing info section');
        return false;
      }
      
      if (!swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
        this.results.errors.push('Swagger spec has no documented paths');
        return false;
      }
      
      if (!swaggerSpec.components?.schemas) {
        this.results.errors.push('Swagger spec missing schemas section');
        return false;
      }
      
      console.log('✅ Swagger schema validation passed');
      return true;
    } catch (error) {
      this.results.errors.push(`Swagger schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting API Documentation Validation...\n');
  
  const validator = new APIDocumentationValidator();
  
  // Validate routes
  console.log('📝 Validating routes...');
  const results = await validator.validateAllRoutes();
  
  // Validate Swagger schema
  console.log('📄 Validating Swagger schema...');
  await validator.validateSwaggerSchema();
  
  // Generate and display report
  console.log('📊 Generating report...');
  const report = validator.generateReport();
  console.log(report);
  
  // Exit with appropriate code
  const hasIssues = results.undocumentedRoutes.length > 0 || 
                   results.missingTags.length > 0 || 
                   results.errors.length > 0;
  
  if (hasIssues) {
    console.log('❌ Validation failed - API documentation needs attention');
    process.exit(1);
  } else {
    console.log('✅ Validation passed - API documentation is complete');
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Validation script failed:', error);
    process.exit(1);
  });
}

export { APIDocumentationValidator };
