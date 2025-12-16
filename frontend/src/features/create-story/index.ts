/**
 * Create Story Feature
 * 
 * This feature module contains all logic for the Story Creation (Draft Workspace) flow.
 * 
 * Structure:
 * - store/ - Zustand state management
 * - components/ - React components for the wizard
 * - hooks/ - Custom React hooks
 * - data/ - Mock data for development
 * 
 * Reference: @docs/CHIMERA_ARCHITECTURE_SPEC.md
 */

// Export store
export { useStoryDraftStore } from './store/useStoryDraftStore';

// Export types (re-export from domain types)
export type { StoryDraft, WorldDefinition, EntityTemplate } from '@/types/chimera-domain';

// Export components
export { CreateStoryPage } from './components/CreateStoryPage';
export { StoryWizardLayout } from './components/StoryWizardLayout';
export { Step1_World } from './components/Step1_World';
export { Step2_Forces } from './components/Step2_Forces';
export { Step3_Elements } from './components/Step3_Elements';
export { Step4_Lore } from './components/Step4_Lore';
export { Step5_Compile } from './components/Step5_Compile';
export { EntityManagerModal } from './components/EntityManagerModal';
export { LoreManagerModal } from './components/LoreManagerModal';
export { RulesetFilterBar } from './components/RulesetFilterBar';

// Export mock data
export { AVAILABLE_RULESETS } from './data/mock-rulesets';
export { WORLD_PRESETS, type WorldPreset } from './data/mock-world-presets';
export { 
  MOCK_USER_WORLDS, 
  MOCK_USER_ENTITIES, 
  MOCK_USER_LORE,
  MOCK_USER_STORIES,
  type LoreFragment,
  type UserWorld,
  type UserEntity,
  type StoryItem,
} from './data/mock-library';

// Export utilities
export { getRequiredStatFields, hasStaminaSystem, getStatLabel } from './utils/ruleset-interpreter';
