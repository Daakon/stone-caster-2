/**
 * Admin Routes Configuration
 * Phase 2: Route definitions for the new admin system
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { Guarded } from './routeGuard';

// Import admin pages
import AdminHome from '@/pages/admin/index';
import EntryPointsAdmin from '@/pages/admin/entry-points/index';
import EntryPointEditPage from '@/pages/admin/entry-points/id';
import EntryWizardPage from '@/pages/admin/entry-points/wizard/[id]';
// PHASE 1.7: Legacy routes removed - NPCs, Worlds, and Rulesets
// These pages used legacy tables and have been deleted.
// Will be replaced with Chimera V3 routes in Phase 2.
import RolesAdmin from '@/pages/admin/roles/index';
import AccessRequestsAdmin from '@/pages/admin/access-requests/index';
import TemplatesManager from '@/pages/admin/TemplatesManager';
import PublishingAdmin from '@/pages/admin/publishing/index';
import PublishingAudit from '@/pages/admin/publishing/audit';
import ApprovalsPage from '@/pages/admin/media/ApprovalsPage';
import PublishingWizard from '@/pages/publishing/wizard';

import PublishingWizardPage from '@/pages/admin/publishing-wizard/[entityType]/[entityId]';
import ChimeraDashboard from '@/pages/admin/chimera/Dashboard';
import RulesetTemplatesDashboard from '@/pages/admin/chimera/rulesets/index';
import RulesetTemplateEditor from '@/pages/admin/chimera/rulesets/Editor';
import ChimeraWorldsAdmin from '@/pages/admin/chimera/worlds/index';
import WorldListPage from '@/pages/admin/chimera/worlds/WorldListPage';
import WorldEditorPage from '@/pages/admin/chimera/worlds/WorldEditorPage';
import ChimeraEntitiesAdmin from '@/pages/admin/chimera/entities/index';
import EntityListPage from '@/pages/admin/chimera/entities/EntityListPage';
import EntityEditorPage from '@/pages/admin/chimera/entities/EntityEditorPage';
import TagManagement from '@/pages/admin/chimera/tags/index';

export function AdminRoutes() {
  return (
    <Routes>
      {/* Default redirect to home */}
      <Route path="/" element={<Navigate to="/admin" replace />} />
      
      {/* Public admin routes (any authenticated user) */}
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/entry-points" element={<EntryPointsAdmin />} />
      <Route path="/entry-points/:id" element={<EntryPointEditPage />} />
      <Route path="/entry-points/wizard/:id" element={<EntryWizardPage />} />
      {/* PHASE 1.7: Legacy routes removed - NPCs, Worlds, and Rulesets */}
      <Route 
        path="/publishing-wizard/:entityType/:entityId" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <PublishingWizardPage />
          </Guarded>
        }
      />
      
      {/* Admin-only routes */}
      <Route 
        path="/roles" 
        element={
          <Guarded allow="admin">
            <RolesAdmin />
          </Guarded>
        } 
      />
      <Route 
        path="/access-requests" 
        element={
          <Guarded allow="admin">
            <AccessRequestsAdmin />
          </Guarded>
        }
      />
      
      {/* Template management routes */}
      <Route 
        path="/templates" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <TemplatesManager />
          </Guarded>
        }
      />
      
      {/* Publishing routes (Phase 0/1) */}
      <Route 
        path="/publishing" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <PublishingAdmin />
          </Guarded>
        }
      />
      <Route 
        path="/publishing/audit" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <PublishingAudit />
          </Guarded>
        }
      />
      
      {/* Publishing wizard (Phase 7) */}
      <Route 
        path="/publishing/wizard" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <PublishingWizard />
          </Guarded>
        }
      />
      
      {/* Media approvals (Phase 3c) */}
      <Route 
        path="/media/approvals" 
        element={
          <Guarded allow="admin">
            <ApprovalsPage />
          </Guarded>
        }
      />
      
      {/* Chimera V2 routes */}
      <Route 
        path="/chimera/dashboard" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ChimeraDashboard />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/rulesets" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <RulesetTemplatesDashboard />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/rulesets/new" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <RulesetTemplateEditor />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/rulesets/edit/:id" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <RulesetTemplateEditor />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/worlds" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ChimeraWorldsAdmin />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/worlds/list" 
        element={
          <Guarded allow="admin">
            <WorldListPage />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/worlds/new" 
        element={
          <Guarded allow="admin">
            <WorldEditorPage />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/worlds/edit/:id" 
        element={
          <Guarded allow="admin">
            <WorldEditorPage />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/entities" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ChimeraEntitiesAdmin />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/entities/list" 
        element={
          <Guarded allow="admin">
            <EntityListPage />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/entities/new" 
        element={
          <Guarded allow="admin">
            <EntityEditorPage />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/entities/edit/:id" 
        element={
          <Guarded allow="admin">
            <EntityEditorPage />
          </Guarded>
        }
      />
      <Route 
        path="/chimera/tags" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <TagManagement />
          </Guarded>
        }
      />
      
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
