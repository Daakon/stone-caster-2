import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import PromptAdmin from '@/pages/admin/PromptAdmin';

export function AdminRouter() {
  console.log('AdminRouter: Rendering admin router - START');
  console.log('AdminRouter: Current location:', window.location.pathname);
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/prompts" replace />} />
        <Route path="/prompts" element={<PromptAdmin />} />
        <Route path="*" element={<Navigate to="/admin/prompts" replace />} />
      </Routes>
    </AdminLayout>
  );
}
