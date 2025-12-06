/**
 * Chimera Worlds Admin Page
 * Phase 5.1: Redirects to official worlds list
 */

import { Navigate } from 'react-router-dom';

export default function ChimeraWorldsAdmin() {
  // Redirect to official worlds list
  return <Navigate to="/admin/chimera/worlds/list" replace />;
}

