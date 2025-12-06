/**
 * Chimera Entities Admin Page
 * Phase 5.2: Redirects to official entities list
 */

import { Navigate } from 'react-router-dom';

export default function ChimeraEntitiesAdmin() {
  // Redirect to official entities list
  return <Navigate to="/admin/chimera/entities/list" replace />;
}
