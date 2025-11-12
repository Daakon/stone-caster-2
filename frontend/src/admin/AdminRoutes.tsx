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
import NPCsAdmin from '@/pages/admin/npcs/index';
import CreateNPCPage from '@/pages/admin/npcs/new';
import NPCDetailPage from '@/pages/admin/npcs/[id]';
import EditNPCPage from '@/pages/admin/npcs/edit';
import WorldsAdmin from '@/pages/admin/worlds/index';
import WorldDetailPage from '@/pages/admin/worlds/[id]';
import WorldNewPage from '@/pages/admin/worlds/new';
import WorldEditPage from '@/pages/admin/worlds/edit';
import RulesetsAdmin from '@/pages/admin/rulesets/index';
import RulesetDetailPage from '@/pages/admin/rulesets/[id]';
import ImportExportPage from '@/pages/admin/tools/import-export';
import ReviewsAdmin from '@/pages/admin/reviews/index';
import ReportsAdmin from '@/pages/admin/reports/index';
import ReportDetailPage from '@/pages/admin/reports/id';
import AnalyticsAdmin from '@/pages/admin/analytics/index';
import RolesAdmin from '@/pages/admin/roles/index';
import AccessRequestsAdmin from '@/pages/admin/access-requests/index';
import TemplatesManager from '@/pages/admin/TemplatesManager';
import PublishingAdmin from '@/pages/admin/publishing/index';
import PublishingAudit from '@/pages/admin/publishing/audit';
import PublishingWizard from '@/pages/publishing/wizard';

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
      <Route path="/npcs" element={<NPCsAdmin />} />
      <Route path="/npcs/new" element={<CreateNPCPage />} />
      <Route path="/npcs/:id" element={<NPCDetailPage />} />
      <Route path="/npcs/:id/edit" element={<EditNPCPage />} />
      
      <Route
          path="/tools/import-export"
          element={
            <Guarded allow={['admin']}>
              <ImportExportPage />
            </Guarded>
          }
        />
      
      {/* Worlds routes (Creators: read; Mods/Admin: CRUD) */}
      <Route 
        path="/worlds" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <WorldsAdmin />
          </Guarded>
        } 
      />
      <Route 
        path="/worlds/new" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <WorldNewPage />
          </Guarded>
        } 
      />
      <Route 
        path="/worlds/:id" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <WorldDetailPage />
          </Guarded>
        } 
      />
      <Route 
        path="/worlds/:id/edit" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <WorldEditPage />
          </Guarded>
        } 
      />
      
      {/* Rulesets routes (Creators: read; Mods/Admin: CRUD) */}
      <Route 
        path="/rulesets" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <RulesetsAdmin />
          </Guarded>
        } 
      />
      <Route 
        path="/rulesets/:id" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <RulesetDetailPage />
          </Guarded>
        } 
      />
      
      {/* Moderator routes */}
      <Route 
        path="/reviews" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ReviewsAdmin />
          </Guarded>
        } 
      />
      <Route 
        path="/reports" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ReportsAdmin />
          </Guarded>
        } 
      />
      <Route 
        path="/reports/:id" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ReportDetailPage />
          </Guarded>
        } 
      />
      <Route 
        path="/analytics" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <AnalyticsAdmin />
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
      
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
