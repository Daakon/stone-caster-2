/**
 * Author Documentation
 * In-product authoring guides for prompt creation
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Search } from 'lucide-react';
import { isAdminPromptFormsEnabled } from '@/lib/feature-flags';

const docsContent = {
  'how-prompts-are-built': {
    title: 'How Prompts Are Built',
    content: `
Prompts are assembled from multiple sources:

1. **Templates (Slots)**: Published templates define the structure for each slot (world.tone, ruleset.principles, npc.bio, etc.)
2. **Extras**: Pack-specific overrides stored in world/ruleset/scenario/NPC extras fields
3. **Module Params**: Configuration parameters for attached modules (when a Story has modules)
4. **Context**: The selected world, ruleset, scenario, and NPCs
5. **Budget**: Token limits applied to keep prompts within model context windows

The system renders templates with Mustache, applies extras overrides, then applies the budget engine to trim content if needed.
    `,
  },
  workflow: {
    title: 'Authoring Workflow',
    content: `
1. **Pick Context**: Select world, ruleset, scenario, NPCs, and templates version
2. **Fill Extras/Params**: Use the Extras Overrides and Module Params tabs to customize
3. **Preview**: Generate a preview to see the TurnPacketV3 JSON and linearized prompt
4. **Budget**: Run a budget report to see token usage and trims
5. **Optional Snapshot**: Create a manual snapshot for later reference
6. **Publish Templates**: When ready, publish new template versions in Template Manager

**Save vs Preview**: 
- **Save** writes changes to packs/stories (persists to database)
- **Preview** uses temporary overrides (does not persist)
    `,
  },
  'version-pinning': {
    title: 'Version Pinning',
    content: `
Stories can pin a specific templates version, or use "Latest Published".

- **Pinned Version**: Story always uses templates from that version (stable, deterministic)
- **Latest Published**: Story automatically uses the newest published templates (updates when templates change)

Use pinning for production stories that need stability. Use Latest for development/testing.
    `,
  },
  'trim-troubleshooting': {
    title: 'Trim Troubleshooting',
    content: `
When prompts are trimmed, content is removed to fit within token limits.

**Why trims happen:**
- Slot bodies are too long
- Duplicate content across slots
- Too many high-priority slots competing for space
- Budget is too low for the content volume

**How to fix:**
1. Shorten slot template bodies (remove redundancy)
2. Reduce duplicate content across slots
3. Increase slot priority only when justified (use must_keep sparingly)
4. Increase budget if content volume is necessary
5. Use min_chars to protect critical slots (but ensure sum doesn't exceed 75% of budget)

**Quick Fix Checklist:**
- [ ] Identify which slot is being trimmed (check budget report)
- [ ] Review template body for redundancy
- [ ] Check if content is duplicated in other slots
- [ ] Consider if slot priority is appropriate
- [ ] Verify min_chars sum doesn't exceed 75% of budget
    `,
  },
  loadouts: {
    title: 'Loadouts',
    content: `
Loadouts are preset configurations that combine:
- A ruleset
- A set of modules
- Initial parameter overrides

**When to use:**
- Standardizing module configurations across stories
- Quick setup for new stories
- Ensuring compatibility between ruleset and modules

**How to apply:**
1. Go to Story Settings → Loadouts tab
2. Select a loadout from the dropdown
3. Click "Apply Loadout"
4. The loadout attaches modules and sets initial params (idempotent)

**How to revert:**
- Detach modules manually in Story Modules page
- Reset params to defaults in Module Params tab
    `,
  },
  glossary: {
    title: 'Glossary',
    content: `
**Slot**: A named template position (e.g., "world.tone", "npc.bio"). Each slot has a type (world, ruleset, npc, scenario, module, ux).

**Module**: A reusable component that adds functionality to stories. Modules have parameters that can be configured per story.

**Loadout**: A preset combination of ruleset + modules + initial parameter overrides, applied to stories.

**Linearized**: The final text representation of the prompt after all templates are rendered and assembled.

**Budget**: The token budgeting engine that trims content to fit within model context limits.

**TurnPacketV3**: The structured JSON format containing all prompt sections before linearization.

**Extras**: Pack-specific JSON overrides that modify template rendering (stored in world/ruleset/scenario/NPC extras fields).

**Templates Version**: A pinned version number for templates, allowing stories to use stable template sets.
    `,
  },
};

export default function AuthorDocs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (!isAdminPromptFormsEnabled()) {
    return (
      <div className="p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Author Docs are disabled. Enable VITE_ADMIN_PROMPT_FORMS_ENABLED to use this feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const filteredSections = Object.entries(docsContent).filter(([key, doc]) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query) ||
      key.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Author Documentation</h1>
        <p className="text-muted-foreground">
          Guide to prompt authoring, templates, and troubleshooting
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Docs Sections */}
      <div className="space-y-4">
        {filteredSections.map(([key, doc]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{doc.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                {doc.content.trim()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSections.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>No documentation found matching "{searchQuery}"</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

