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
      <Route path="/admin/entry-points" element={<EntryPointsAdmin />} />
      <Route path="/admin/entry-points/:id" element={<EntryPointEditPage />} />
      <Route path="/admin/prompt-segments" element={<PromptSegmentsAdmin />} />
      <Route path="/admin/npcs" element={<NPCsAdmin />} />
      
      {/* Moderator routes */}
      <Route 
        path="/admin/reviews" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ReviewsAdmin />
          </Guarded>
        } 
      />
      <Route 
        path="/admin/reports" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ReportsAdmin />
          </Guarded>
        } 
      />
      <Route 
        path="/admin/reports/:id" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <ReportDetailPage />
          </Guarded>
        } 
      />
      <Route 
        path="/admin/analytics" 
        element={
          <Guarded allow={['moderator', 'admin']}>
            <AnalyticsAdmin />
          </Guarded>
        } 
      />
      
      {/* Admin-only routes */}
      <Route 
        path="/admin/roles" 
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
