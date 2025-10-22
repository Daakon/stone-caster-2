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
import PromptSegmentsAdmin from '@/pages/admin/prompt-segments/index';
import NPCsAdmin from '@/pages/admin/npcs/index';
import WorldsAdmin from '@/pages/admin/worlds/index';
import WorldDetailPage from '@/pages/admin/worlds/[id]';
import RulesetsAdmin from '@/pages/admin/rulesets/index';
import RulesetDetailPage from '@/pages/admin/rulesets/[id]';
import ReviewsAdmin from '@/pages/admin/reviews/index';
import ReportsAdmin from '@/pages/admin/reports/index';
import ReportDetailPage from '@/pages/admin/reports/id';
import AnalyticsAdmin from '@/pages/admin/analytics/index';
import RolesAdmin from '@/pages/admin/roles/index';

export function AdminRoutes() {
  return (
    <Routes>
      {/* Default redirect to home */}
      <Route path="/" element={<Navigate to="/admin" replace />} />
      
      {/* Public admin routes (any authenticated user) */}
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/entry-points" element={<EntryPointsAdmin />} />
      <Route path="/entry-points/:id" element={<EntryPointEditPage />} />
      <Route path="/prompt-segments" element={<PromptSegmentsAdmin />} />
      <Route path="/npcs" element={<NPCsAdmin />} />
      
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
        path="/worlds/:id" 
        element={
          <Guarded allow={['creator', 'moderator', 'admin']}>
            <WorldDetailPage />
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
      
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
