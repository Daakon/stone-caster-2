#!/usr/bin/env tsx

/**
 * API Documentation CI/CD Integration
 * 
 * This script integrates with CI/CD pipelines to ensure API documentation
 * is always up-to-date and serves as the source of truth.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CIConfig {
  validateOnPush: boolean;
  validateOnPR: boolean;
  autoGenerateMissing: boolean;
  failOnMissingDocs: boolean;
  swaggerEndpoint: string;
  generateOpenAPISpec: boolean;
}

class APIDocumentationCI {
  private config: CIConfig;
  private isCI: boolean;

  constructor() {
    this.isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    this.config = {
      validateOnPush: true,
      validateOnPR: true,
      autoGenerateMissing: false,
      failOnMissingDocs: true,
      swaggerEndpoint: '/api-docs',
      generateOpenAPISpec: true
    };
  }

  /**
   * Run API documentation validation
   */
  async validateDocumentation(): Promise<boolean> {
    console.log('🔍 Validating API documentation...');
    
    try {
      // Run the validation script
      const result = execSync('tsx scripts/validate-api-docs.ts', {
        cwd: process.cwd(),
        encoding: 'utf-8'
      });
      
      console.log(result);
      return true;
    } catch (error) {
      console.error('❌ API documentation validation failed');
      console.error(error);
      return false;
    }
  }

  /**
   * Generate missing documentation
   */
  async generateMissingDocumentation(): Promise<boolean> {
    console.log('📝 Generating missing API documentation...');
    
    try {
      const result = execSync('tsx scripts/generate-swagger-docs.ts', {
        cwd: process.cwd(),
        encoding: 'utf-8'
      });
      
      console.log(result);
      return true;
    } catch (error) {
      console.error('❌ Documentation generation failed');
      console.error(error);
      return false;
    }
  }

  /**
   * Generate OpenAPI specification file
   */
  async generateOpenAPISpec(): Promise<boolean> {
    console.log('📄 Generating OpenAPI specification...');
    
    try {
      // Import the swagger spec
      const { swaggerSpec } = await import('../dist/config/swagger.js');
      
      // Write to file
      const specPath = join(process.cwd(), 'api-spec.json');
      writeFileSync(specPath, JSON.stringify(swaggerSpec, null, 2));
      
      console.log(`✅ OpenAPI spec generated: ${specPath}`);
      return true;
    } catch (error) {
      console.error('❌ OpenAPI spec generation failed');
      console.error(error);
      return false;
    }
  }

  /**
   * Update API contract documentation
   */
  async updateAPIContract(): Promise<void> {
    console.log('📋 Updating API contract documentation...');
    
    const contractPath = join(process.cwd(), '..', 'docs', 'API_CONTRACT.md');
    
    if (!existsSync(contractPath)) {
      console.log('⚠️  API_CONTRACT.md not found, skipping update');
      return;
    }

    try {
      // Generate current API spec
      const { swaggerSpec } = await import('../dist/config/swagger.js');
      
      // Create API contract content
      const contractContent = this.generateAPIContractContent(swaggerSpec);
      
      // Update the file
      writeFileSync(contractPath, contractContent);
      console.log('✅ API contract documentation updated');
    } catch (error) {
      console.error('❌ API contract update failed');
      console.error(error);
    }
  }

  /**
   * Generate API contract content
   */
  private generateAPIContractContent(spec: any): string {
    let content = '# API Contract\n\n';
    content += `*Generated on: ${new Date().toISOString()}*\n\n`;
    content += 'This document serves as the authoritative source for the StoneCaster API structure.\n\n';
    
    // API Info
    content += '## API Information\n\n';
    content += `- **Title**: ${spec.info?.title || 'StoneCaster API'}\n`;
    content += `- **Version**: ${spec.info?.version || '1.0.0'}\n`;
    content += `- **Description**: ${spec.info?.description || 'StoneCaster API'}\n\n`;
    
    // Servers
    if (spec.servers && spec.servers.length > 0) {
      content += '## Servers\n\n';
      spec.servers.forEach((server: any) => {
        content += `- **${server.description}**: ${server.url}\n`;
      });
      content += '\n';
    }
    
    // Endpoints by tag
    const endpointsByTag: Record<string, any[]> = {};
    
    if (spec.paths) {
      Object.entries(spec.paths).forEach(([path, methods]: [string, any]) => {
        Object.entries(methods).forEach(([method, details]: [string, any]) => {
          const tags = details.tags || ['General'];
          tags.forEach((tag: string) => {
            if (!endpointsByTag[tag]) {
              endpointsByTag[tag] = [];
            }
            endpointsByTag[tag].push({
              method: method.toUpperCase(),
              path,
              summary: details.summary,
              description: details.description
            });
          });
        });
      });
    }
    
    // Generate endpoint documentation
    Object.entries(endpointsByTag).forEach(([tag, endpoints]) => {
      content += `## ${tag}\n\n`;
      
      endpoints.forEach(endpoint => {
        content += `### ${endpoint.method} ${endpoint.path}\n\n`;
        content += `**Summary**: ${endpoint.summary || 'No summary'}\n\n`;
        if (endpoint.description) {
          content += `**Description**: ${endpoint.description}\n\n`;
        }
        content += '---\n\n';
      });
    });
    
    // Schemas
    if (spec.components?.schemas) {
      content += '## Data Schemas\n\n';
      Object.entries(spec.components.schemas).forEach(([name, schema]: [string, any]) => {
        content += `### ${name}\n\n`;
        content += '```json\n';
        content += JSON.stringify(schema, null, 2);
        content += '\n```\n\n';
      });
    }
    
    return content;
  }

  /**
   * Run pre-commit checks
   */
  async runPreCommitChecks(): Promise<boolean> {
    console.log('🚀 Running pre-commit API documentation checks...\n');
    
    let allPassed = true;
    
    // Validate documentation
    if (!(await this.validateDocumentation())) {
      allPassed = false;
    }
    
    // Generate OpenAPI spec if enabled
    if (this.config.generateOpenAPISpec) {
      if (!(await this.generateOpenAPISpec())) {
        allPassed = false;
      }
    }
    
    // Update API contract
    await this.updateAPIContract();
    
    if (allPassed) {
      console.log('\n✅ All pre-commit checks passed');
    } else {
      console.log('\n❌ Some pre-commit checks failed');
    }
    
    return allPassed;
  }

  /**
   * Run post-merge checks
   */
  async runPostMergeChecks(): Promise<void> {
    console.log('🔄 Running post-merge API documentation checks...\n');
    
    // Auto-generate missing documentation if enabled
    if (this.config.autoGenerateMissing) {
      await this.generateMissingDocumentation();
    }
    
    // Update API contract
    await this.updateAPIContract();
    
    // Generate OpenAPI spec
    if (this.config.generateOpenAPISpec) {
      await this.generateOpenAPISpec();
    }
    
    console.log('\n✅ Post-merge checks completed');
  }

  /**
   * Main CI/CD runner
   */
  async run(): Promise<void> {
    const command = process.argv[2];
    
    switch (command) {
      case 'pre-commit':
        const preCommitPassed = await this.runPreCommitChecks();
        process.exit(preCommitPassed ? 0 : 1);
        break;
        
      case 'post-merge':
        await this.runPostMergeChecks();
        process.exit(0);
        break;
        
      case 'validate':
        const validationPassed = await this.validateDocumentation();
        process.exit(validationPassed ? 0 : 1);
        break;
        
      case 'generate':
        await this.generateMissingDocumentation();
        process.exit(0);
        break;
        
      case 'spec':
        await this.generateOpenAPISpec();
        process.exit(0);
        break;
        
      default:
        console.log('Usage: tsx scripts/api-docs-ci.ts <command>');
        console.log('Commands:');
        console.log('  pre-commit  - Run pre-commit checks');
        console.log('  post-merge  - Run post-merge updates');
        console.log('  validate    - Validate documentation');
        console.log('  generate    - Generate missing docs');
        console.log('  spec        - Generate OpenAPI spec');
        process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const ci = new APIDocumentationCI();
  await ci.run();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 CI/CD script failed:', error);
    process.exit(1);
  });
}

export { APIDocumentationCI };
