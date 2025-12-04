import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import PromptAdmin from '@/pages/admin/PromptAdmin';
import TemplatesManager from '@/pages/admin/TemplatesManager';
import PromptSnapshots from '@/pages/admin/PromptSnapshots';
import PromptPreview from '@/pages/admin/PromptPreview';
import StorySettings from '@/pages/admin/StorySettings';
import FieldRegistry from '@/pages/admin/FieldRegistry';
import ScenarioGraphEditor from '@/pages/admin/ScenarioGraphEditor';
import PromptBuilder from '@/pages/admin/PromptBuilder';
import Health from '@/pages/admin/Health';
import AuthorDocs from '@/pages/admin/AuthorDocs';

export function AdminRouter() {

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/prompts" replace />} />
        <Route path="/prompts" element={<PromptAdmin />} />
        <Route path="/templates" element={<TemplatesManager />} />
        <Route path="/prompt-snapshots" element={<PromptSnapshots />} />
        <Route path="/prompt-preview" element={<PromptPreview />} />
        <Route path="/prompt-builder" element={<PromptBuilder />} />
        <Route path="/field-registry" element={<FieldRegistry />} />
        <Route path="/scenarios/:id/graph" element={<ScenarioGraphEditor />} />
        <Route path="/stories/:gameId/settings" element={<StorySettings />} />
        <Route path="/health" element={<Health />} />
        <Route path="/docs/prompt-authoring" element={<AuthorDocs />} />
        <Route path="*" element={<Navigate to="/admin/prompts" replace />} />
      </Routes>
    </AdminLayout>
  );
}
