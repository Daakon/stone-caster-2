import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import PromptAdmin from '@/pages/admin/PromptAdmin';
import AwfCoreContractsAdmin from '@/pages/admin/AwfCoreContractsAdmin';
import AwfRulesetsAdmin from '@/pages/admin/AwfRulesetsAdmin';
import AwfWorldsAdmin from '@/pages/admin/AwfWorldsAdmin';
import AwfAdventuresAdmin from '@/pages/admin/AwfAdventuresAdmin';
import AwfAdventureStartsAdmin from '@/pages/admin/AwfAdventureStartsAdmin';
import TemplatesManager from '@/pages/admin/TemplatesManager';
import PromptSnapshots from '@/pages/admin/PromptSnapshots';
import PromptPreview from '@/pages/admin/PromptPreview';
import StorySettings from '@/pages/admin/StorySettings';
import FieldRegistry from '@/pages/admin/FieldRegistry';
import ScenarioGraphEditor from '@/pages/admin/ScenarioGraphEditor';
import Modules from '@/pages/admin/Modules';
import ModuleDetail from '@/pages/admin/ModuleDetail';
import StoryModules from '@/pages/admin/StoryModules';
import ModuleParams from '@/pages/admin/ModuleParams';
import Loadouts from '@/pages/admin/Loadouts';
import LoadoutDetail from '@/pages/admin/LoadoutDetail';
import ApplyLoadout from '@/pages/admin/ApplyLoadout';
import Telemetry from '@/pages/admin/Telemetry';
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
        <Route path="/modules" element={<Modules />} />
        <Route path="/modules/:id" element={<ModuleDetail />} />
        <Route path="/stories/:id/modules" element={<StoryModules />} />
        <Route path="/stories/:id/modules/params" element={<ModuleParams />} />
        <Route path="/loadouts" element={<Loadouts />} />
        <Route path="/loadouts/:id" element={<LoadoutDetail />} />
        <Route path="/stories/:id/apply-loadout" element={<ApplyLoadout />} />
        <Route path="/awf/core-contracts" element={<AwfCoreContractsAdmin />} />
        <Route path="/awf/rulesets" element={<AwfRulesetsAdmin />} />
        <Route path="/awf/worlds" element={<AwfWorldsAdmin />} />
        <Route path="/awf/adventures" element={<AwfAdventuresAdmin />} />
        <Route path="/awf/adventure-starts" element={<AwfAdventureStartsAdmin />} />
        <Route path="/telemetry" element={<Telemetry />} />
        <Route path="/health" element={<Health />} />
        <Route path="/docs/prompt-authoring" element={<AuthorDocs />} />
        <Route path="*" element={<Navigate to="/admin/prompts" replace />} />
      </Routes>
    </AdminLayout>
  );
}
