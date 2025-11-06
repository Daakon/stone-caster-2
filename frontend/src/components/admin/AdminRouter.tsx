import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import PromptAdmin from '@/pages/admin/PromptAdmin';
import AwfCoreContractsAdmin from '@/pages/admin/AwfCoreContractsAdmin';
import AwfRulesetsAdmin from '@/pages/admin/AwfRulesetsAdmin';
import AwfWorldsAdmin from '@/pages/admin/AwfWorldsAdmin';
import AwfAdventuresAdmin from '@/pages/admin/AwfAdventuresAdmin';
import AwfAdventureStartsAdmin from '@/pages/admin/AwfAdventureStartsAdmin';

export function AdminRouter() {

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/prompts" replace />} />
        <Route path="/prompts" element={<PromptAdmin />} />
        <Route path="/awf/core-contracts" element={<AwfCoreContractsAdmin />} />
        <Route path="/awf/rulesets" element={<AwfRulesetsAdmin />} />
        <Route path="/awf/worlds" element={<AwfWorldsAdmin />} />
        <Route path="/awf/adventures" element={<AwfAdventuresAdmin />} />
        <Route path="/awf/adventure-starts" element={<AwfAdventureStartsAdmin />} />
        <Route path="*" element={<Navigate to="/admin/prompts" replace />} />
      </Routes>
    </AdminLayout>
  );
}
