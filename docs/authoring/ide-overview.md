# Authoring IDE Overview

## Introduction

The Authoring IDE is a first-class web interface for internal authors to create, edit, validate, and publish AWF documents. It provides a unified environment for managing all content types while maintaining strict quality gates and version control.

## Key Features

### Tabbed Editor Interface
- **File Tree**: Organized by namespace/ref/version with search and filtering
- **Dual Format Support**: JSON/YAML editing with format conversion
- **Schema-Aware Editing**: Autocomplete, hover docs, and inline diagnostics
- **Real-Time Validation**: Instant feedback on syntax and content errors

### One-Click Actions
- **Validate**: Run all linters and validators with detailed diagnostics
- **Playtest Verify**: Record and verify playtest sessions
- **Assemble Preview**: Generate AWF bundle with token estimates
- **Diff**: Side-by-side comparison with version history
- **Publish Gate**: Comprehensive pre-publish validation

### Side Panel Features
- **Cross-References**: Shows which documents reference the current document
- **Token Estimates**: Real-time token usage and budget tracking
- **Hash Display**: Content integrity verification
- **Playtest Reports**: Links to latest test results and verification status

## Document Types

### Core Documents
- **World**: World settings, climate, magic level, technology
- **Adventure**: Adventure metadata, difficulty, estimated duration
- **Quest Graph**: Node definitions, edges, guards, and transitions
- **Start**: Adventure starting conditions and initial state

### Content Documents
- **Items**: Weapons, armor, consumables, and equipment
- **Recipes**: Crafting formulas and requirements
- **Loot**: Treasure tables and drop rates
- **Vendors**: Shop inventories and pricing

### System Documents
- **NPC Personality**: Character traits, trust levels, and behavior
- **Localization**: Translation keys and language support
- **Sim Config**: World simulation settings and parameters
- **Party Config**: Party system settings and limits

## Workflow

### Draft Management
1. **Create Draft**: Start with document template or existing version
2. **Edit Content**: Use schema-aware editor with real-time validation
3. **Validate**: Run comprehensive linters and content checks
4. **Preview**: Generate AWF bundle to verify token usage and content
5. **Playtest**: Record and verify gameplay sessions
6. **Publish**: Move draft to versioned state with changelog

### Version Control
- **Draft Workspace**: Safe editing environment with auto-save
- **Version Bumping**: Semantic versioning with changelog generation
- **Publish Gates**: Automated validation before version release
- **Rollback Support**: Revert to previous versions if needed

### Quality Assurance
- **Linter Integration**: All Phase 9+ linters run automatically
- **Token Budget**: Real-time tracking against 8000 token limit
- **Cross-Reference Validation**: Ensure all references are valid
- **Playtest Verification**: Required for adventure and world documents

## Keyboard Shortcuts

### Navigation
- `Ctrl/Cmd + P`: Quick file search
- `Ctrl/Cmd + Shift + P`: Command palette
- `Ctrl/Cmd + B`: Toggle sidebar
- `Ctrl/Cmd + J`: Toggle bottom panel

### Editing
- `Ctrl/Cmd + S`: Save document
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Y`: Redo
- `Ctrl/Cmd + F`: Find in document
- `Ctrl/Cmd + H`: Find and replace

### Actions
- `Ctrl/Cmd + Enter`: Validate document
- `Alt + P`: Preview bundle
- `Alt + T`: Record playtest
- `Alt + D`: Show diff
- `Alt + Shift + P`: Publish document

## User Interface

### Main Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Document Name | Status | Actions                    │
├─────────────────────────────────────────────────────────────┤
│ Sidebar │ Editor Area                    │ Diagnostics Panel │
│         │                                │                  │
│ File    │ ┌─────────────────────────────┐ │ ┌──────────────┐ │
│ Tree    │ │                           │ │ │ Diagnostics  │ │
│         │ │     Monaco Editor         │ │ │              │ │
│ Search  │ │                           │ │ │ • Errors     │ │
│         │ │                           │ │ │ • Warnings   │ │
│ Filters │ │                           │ │ │ • Info       │ │
│         │ └─────────────────────────────┘ │ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Document Explorer
- **Hierarchical View**: Organized by document type and namespace
- **Status Indicators**: Draft, published, archived states
- **Version Badges**: Current version and status
- **Search & Filter**: Quick document discovery
- **Context Menu**: Right-click actions for document management

### Editor Features
- **Syntax Highlighting**: Language-specific color coding
- **Auto-Complete**: Schema-aware suggestions
- **Error Highlighting**: Inline diagnostic markers
- **Format Conversion**: JSON ↔ YAML conversion
- **Code Folding**: Collapsible sections for large documents

### Diagnostics Panel
- **Error Summary**: Count and severity breakdown
- **Detailed Messages**: Full error descriptions with suggestions
- **Location Links**: Click to jump to error location
- **Quick Fixes**: Suggested corrections where available

## Best Practices

### Document Organization
- Use consistent naming conventions for document references
- Group related documents in logical namespaces
- Keep document sizes reasonable for performance
- Use meaningful version numbers and changelog entries

### Content Quality
- Run validation frequently during editing
- Address all errors before publishing
- Use preview to verify token usage
- Test content with playtest sessions

### Collaboration
- Use workspaces for team collaboration
- Communicate changes through changelog entries
- Review cross-references before publishing
- Coordinate on shared document updates

### Performance
- Keep individual documents under 512KB
- Use efficient JSON structure
- Minimize deep nesting in document hierarchy
- Regular cleanup of unused drafts

## Troubleshooting

### Common Issues
- **Validation Errors**: Check schema compliance and required fields
- **Token Overruns**: Use preview to identify high-token sections
- **Reference Errors**: Verify all cross-references are valid
- **Publish Failures**: Check all gates pass before publishing

### Performance Problems
- **Slow Loading**: Check document size and complexity
- **Editor Lag**: Reduce document size or split into smaller parts
- **Search Issues**: Use specific search terms and filters
- **Memory Usage**: Close unused documents and clear cache

### Collaboration Issues
- **Merge Conflicts**: Use diff view to resolve conflicts
- **Permission Errors**: Check workspace membership and roles
- **Version Conflicts**: Coordinate version numbering with team
- **Reference Updates**: Update all references when renaming documents

## Integration

### External Tools
- **Version Control**: Git integration for document history
- **CI/CD**: Automated validation and testing
- **Monitoring**: Usage metrics and performance tracking
- **Backup**: Regular document backup and recovery

### API Access
- **WorldBuilder API**: Programmatic document management
- **Webhook Support**: Real-time updates and notifications
- **Export/Import**: Bulk document operations
- **Custom Tools**: Integration with external authoring tools

## Security

### Access Control
- **Role-Based Permissions**: Author, editor, admin roles
- **Workspace Isolation**: Team-based document access
- **Audit Logging**: Complete action history tracking
- **Secure Storage**: Encrypted document storage

### Data Protection
- **Input Validation**: All content validated before storage
- **XSS Prevention**: Sanitized content rendering
- **CSRF Protection**: Secure form submissions
- **Rate Limiting**: API abuse prevention

## Future Enhancements

### Planned Features
- **Real-Time Collaboration**: Multi-user editing support
- **Advanced Search**: Full-text search across all documents
- **Template System**: Reusable document templates
- **Workflow Automation**: Custom validation and publish workflows

### Integration Opportunities
- **External Editors**: Support for external editing tools
- **Version Control**: Git-based document versioning
- **Testing Framework**: Automated content testing
- **Analytics**: Usage and performance analytics


