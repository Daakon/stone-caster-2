# Legacy Admin Components

This directory contains admin components that were identified as unused during the Phase A cleanup.

## Moved Components

### Admin Components
- `EntryRulesetsPicker.tsx` - Unused ruleset picker component
- `ModerationButtons.tsx` - Unused moderation action buttons
- `NpcBindingsTable.tsx` - Unused NPC bindings table
- `NpcForm.tsx` - Unused NPC form component
- `NpcPortraitUploader.tsx` - Unused NPC portrait uploader
- `NpcTierEditor.tsx` - Unused NPC tier editor

### Admin Pages
- `AwfInjectionMapEditor.tsx` - Unused AWF injection map editor
- `AwfScenariosAdmin.tsx` - Unused AWF scenarios admin
- `EconomyDashboard.tsx` - Unused economy dashboard
- `ExperimentsDashboard.tsx` - Unused experiments dashboard
- `LiveOpsPanel.tsx` - Unused live ops panel
- `MarketplaceReview.tsx` - Unused marketplace review
- `MetricsOverview.tsx` - Unused metrics overview
- `NarrativeHealthDashboard.tsx` - Unused narrative health dashboard
- `OpsDashboard.tsx` - Unused ops dashboard
- `TestLab.tsx` - Unused test lab

## Reason for Moving

These components were identified as unused by the audit tools (knip, ts-prune, unimported, depcheck) and are not referenced by the current admin navigation or routing system. They were moved here instead of being deleted to preserve them for potential future use.

## Restoration

If any of these components are needed in the future, they can be moved back to their original locations and the imports can be restored.

## Audit Results

- **Knip**: Identified as unused files
- **ts-prune**: No exports used
- **unimported**: Not imported anywhere
- **depcheck**: No dependencies on these files
