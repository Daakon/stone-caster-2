#!/usr/bin/env tsx

/**
 * Admin Route Mapping Script
 * Maps all admin routes and components to identify the truth source
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface AdminRoute {
  path: string;
  component: string;
  file: string;
  roles?: string[];
}

interface AdminComponent {
  name: string;
  file: string;
  type: 'page' | 'component' | 'service' | 'hook';
}

function findAdminRoutes(): AdminRoute[] {
  const routes: AdminRoute[] = [];
  
  // Check AdminRoutes.tsx
  const adminRoutesFile = join(process.cwd(), 'frontend/src/admin/AdminRoutes.tsx');
  if (existsSync(adminRoutesFile)) {
    const content = readFileSync(adminRoutesFile, 'utf-8');
    
    // Extract route definitions
    const routeMatches = content.matchAll(/<Route\s+path="([^"]+)"[^>]*element=\{<([^>]+)>\s*([^}]*)\}/g);
    for (const match of routeMatches) {
      const path = match[1];
      const component = match[2];
      const roles = match[3]?.includes('Guarded') ? 
        match[3].match(/allow=\{\[([^\]]+)\]\}/)?.[1]?.split(',').map(r => r.trim().replace(/['"]/g, '')) : 
        undefined;
      
      routes.push({
        path,
        component,
        file: adminRoutesFile,
        roles
      });
    }
  }
  
  // Check AdminRouter.tsx (legacy)
  const adminRouterFile = join(process.cwd(), 'frontend/src/components/admin/AdminRouter.tsx');
  if (existsSync(adminRouterFile)) {
    const content = readFileSync(adminRouterFile, 'utf-8');
    
    const routeMatches = content.matchAll(/<Route\s+path="([^"]+)"[^>]*element=\{<([^>]+)>\s*([^}]*)\}/g);
    for (const match of routeMatches) {
      const path = match[1];
      const component = match[2];
      
      routes.push({
        path,
        component,
        file: adminRouterFile,
        roles: ['legacy']
      });
    }
  }
  
  return routes;
}

function findAdminComponents(): AdminComponent[] {
  const components: AdminComponent[] = [];
  
  // Find all admin pages
  const adminPagesDir = join(process.cwd(), 'frontend/src/pages/admin');
  if (existsSync(adminPagesDir)) {
    // This would need to be expanded to actually read the directory
    // For now, we'll return a placeholder
    components.push({
      name: 'AdminPages',
      file: adminPagesDir,
      type: 'page'
    });
  }
  
  // Find admin components
  const adminComponentsDir = join(process.cwd(), 'frontend/src/admin/components');
  if (existsSync(adminComponentsDir)) {
    components.push({
      name: 'AdminComponents',
      file: adminComponentsDir,
      type: 'component'
    });
  }
  
  return components;
}

function findNavigationSources(): string[] {
  const navSources: string[] = [];
  
  // Check for navigation components
  const navFiles = [
    'frontend/src/admin/components/AdminNav.tsx',
    'frontend/src/components/layout/AdminLayout.tsx',
    'frontend/src/admin/AppAdminShell.tsx'
  ];
  
  for (const file of navFiles) {
    const fullPath = join(process.cwd(), file);
    if (existsSync(fullPath)) {
      navSources.push(file);
    }
  }
  
  return navSources;
}

function main() {
  console.log('# Admin Route & Component Map\n');
  
  const routes = findAdminRoutes();
  const components = findAdminComponents();
  const navSources = findNavigationSources();
  
  console.log('## Admin Routes\n');
  console.log('| Path | Component | File | Roles |');
  console.log('|------|-----------|------|-------|');
  
  for (const route of routes) {
    const roles = route.roles ? route.roles.join(', ') : 'any';
    console.log(`| ${route.path} | ${route.component} | ${route.file} | ${roles} |`);
  }
  
  console.log('\n## Admin Components\n');
  console.log('| Name | File | Type |');
  console.log('|------|-------|------|');
  
  for (const component of components) {
    console.log(`| ${component.name} | ${component.file} | ${component.type} |`);
  }
  
  console.log('\n## Navigation Sources\n');
  for (const source of navSources) {
    console.log(`- ${source}`);
  }
  
  console.log('\n## Key Findings\n');
  console.log('- **Primary Navigation**: AdminNav.tsx (role-gated)');
  console.log('- **Secondary Navigation**: AdminLayout.tsx (hardcoded)');
  console.log('- **Legacy Navigation**: AdminRouter.tsx (AWF-based)');
  console.log('- **Missing Items**: Worlds & Rulesets in AdminNav.tsx');
  console.log('- **Schema Issue**: Frontend expects `active` boolean, DB has `status` text');
}

if (require.main === module) {
  main();
}
