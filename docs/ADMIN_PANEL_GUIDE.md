# Admin Panel Guide

## Overview

The Admin Panel provides a user-friendly interface for managing production prompts in the Stone Caster system. It's designed for non-technical users to easily edit prompts, manage dependencies, and ensure system integrity.
For a quick checklist, see `PROMPT_ENTRY_GUIDE.md`.

## Access Control

### Authentication
- Only users with `prompt_admin` role can access the admin panel
- Access is controlled via Supabase RLS policies
- Role verification happens before any admin components mount
- Admin navigation is completely hidden from non-admin users

### Security Features
- **Isolated Admin Surface**: Admin routes are completely separate from main app
- **Pre-route Verification**: Role checked before rendering any admin components
- **No Side-channel Hints**: Admin links only appear for confirmed admin users
- **Clean Redirects**: Non-admin users redirected to safe defaults

### URL
- Admin Panel: `/admin/prompts`
- Protected route requiring authentication and admin role
- Access denied for users without `prompt_admin` role

## Features

### 1. Prompt Management

#### Viewing Prompts
- **List View**: All prompts displayed with key information
- **Filtering**: Filter by layer, world, active status, and search terms
- **Sorting**: Automatic sorting by layer and sort order
- **Status Indicators**: Visual badges for active/inactive, locked, and dependency issues

#### Editing Prompts
- **Tabbed Interface**: Organized editing with separate tabs for:
  - Basic Info (layer, world, adventure, scene, turn stage, etc.)
  - Content (prompt text with syntax highlighting)
  - Dependencies (manage prompt dependencies)
  - Metadata (JSON view with pretty formatting)

#### Prompt Properties
- **Layer**: `core`, `world`, `adventure`, `adventure_start`, or `optional` (legacy layers remain selectable for cleanup)
- **Category** *(optional)*: Sub-group within a layer (e.g. `logic`, `output_rules`, `world_npcs`)
- **Subcategory** *(optional)*: Second-level grouping for fine-grained control (e.g. `villages`, `boss_encounters`)
- **World Slug**: Optional world-specific prompts
- **Adventure Slug**: Optional adventure-specific prompts
- **Scene ID**: Optional scene-specific prompts
- **Turn Stage**: Any, Start, Ongoing, End
- **Sort Order**: Load order within layer
- **Version**: Semantic versioning
- **Active**: Whether prompt is active
- **Locked**: Whether prompt can be modified

#### Suggested Categories by Layer
| Layer | Primary Purpose | Common Categories |
|-------|-----------------|-------------------|
| `core` | System-wide rules and guardrails | `logic`, `output_rules`, `npc_agency`, `failsafes` |
| `world` | Setting-specific lore and mechanics | `world_rules`, `world_npcs`, `world_events` |
| `adventure` | Dynamic narrative beats per adventure | `story_beats`, `encounters`, `adventure_npcs` |
| `adventure_start` | Opening state for new games | `opening_state`, `intro`, `npc_snapshot` |
| `optional` | Experimental or add-on content | `playtest`, `legacy`, `debug` |

Use the quick-pick buttons in the editor to apply the recommended categories, or type your own values if you need a bespoke grouping.

### 2. Dependency Management

#### Dependency Validation
- **Automatic Checking**: System validates all prompt dependencies on load
- **Visual Indicators**: Red badges show prompts with missing dependencies
- **Dependency List**: Easy-to-use interface for adding/removing dependencies
- **Validation Alerts**: System-wide alerts for dependency issues

#### Adding Dependencies
1. Open prompt for editing
2. Navigate to "Dependencies" tab
3. Type dependency name in input field
4. Press Enter or click "Add"
5. Dependencies appear as removable badges

### 3. JSON Handling

#### Pretty Formatting in UI
- **Readable Display**: JSON metadata formatted with proper indentation
- **Copy to Clipboard**: One-click copying of formatted JSON
- **Syntax Highlighting**: Color-coded JSON for better readability

#### Minified Storage in Database
- **Automatic Minification**: JSON automatically minified when saving
- **Storage Efficiency**: Reduced database storage requirements
- **Performance**: Faster database operations with smaller JSON payloads

### 4. Bulk Operations

#### Available Operations
- **Activate/Deactivate**: Toggle multiple prompts at once
- **Lock/Unlock**: Lock or unlock multiple prompts
- **Bulk Actions**: Select multiple prompts for batch operations

#### Usage
1. Select prompts using checkboxes
2. Choose bulk action from dropdown
3. Confirm operation
4. System processes all selected prompts

### 5. Statistics Dashboard

#### Key Metrics
- **Total Prompts**: Complete count of all prompts
- **Active Prompts**: Currently active prompts
- **Locked Prompts**: Prompts that cannot be modified
- **Worlds Count**: Number of unique worlds
- **Dependency Issues**: Count of prompts with missing dependencies

#### Real-time Updates
- Statistics update automatically after changes
- Dependency validation runs on each load
- Visual indicators show system health

## User Interface

### Mobile-First Design
- **Responsive Layout**: Works on all screen sizes
- **Touch-Friendly**: Large buttons and touch targets
- **Mobile Navigation**: Hamburger menu for mobile devices

### Accessibility
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: High contrast for better visibility
- **Focus Management**: Clear focus indicators

### Visual Design
- **Clean Interface**: Minimal, professional design
- **Status Colors**: Green for active, red for issues, orange for locked
- **Loading States**: Clear loading indicators
- **Error Handling**: User-friendly error messages

## Technical Implementation

### Frontend Architecture
- **React + TypeScript**: Type-safe development
- **shadcn/ui Components**: Consistent UI components
- **Tailwind CSS**: Utility-first styling
- **React Query**: Efficient data fetching and caching

### Backend API
- **RESTful Endpoints**: Standard HTTP methods
- **Zod Validation**: Type-safe request validation
- **Error Handling**: Consistent error responses
- **Authentication**: JWT-based authentication

### Database Integration
- **Supabase**: PostgreSQL with RLS
- **Row Level Security**: Secure data access
- **Real-time Updates**: Live data synchronization
- **Optimized Queries**: Efficient database operations

## Security Considerations

### Access Control
- **Role-Based Access**: Only prompt_admin role can access
- **RLS Policies**: Database-level security
- **JWT Validation**: Secure token-based authentication

### Data Protection
- **Input Validation**: All inputs validated with Zod
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Sanitized user inputs
- **CSRF Protection**: Secure form submissions

### Audit Trail
- **Change Tracking**: All modifications logged
- **User Attribution**: Changes linked to users
- **Timestamp Recording**: Precise change timing
- **Version History**: Complete change history

## Best Practices

### Prompt Management
1. **Test Changes**: Always test prompts in development first
2. **Version Control**: Use semantic versioning for prompts
3. **Documentation**: Document complex prompt logic
4. **Dependencies**: Keep dependencies up to date

### System Maintenance
1. **Regular Validation**: Run dependency checks regularly
2. **Monitor Statistics**: Watch for unusual patterns
3. **Backup Data**: Regular database backups
4. **Update Dependencies**: Keep system dependencies current

### User Training
1. **Role Assignment**: Only assign admin role to trusted users
2. **Training Materials**: Provide comprehensive documentation
3. **Support Access**: Ensure technical support is available
4. **Change Procedures**: Establish clear change management processes

## Troubleshooting

### Common Issues

#### Access Denied
- **Check Role**: Verify user has prompt_admin role
- **Authentication**: Ensure user is properly authenticated
- **Permissions**: Check Supabase RLS policies

#### Dependency Errors
- **Missing Dependencies**: Check if referenced prompts exist
- **Circular Dependencies**: Avoid circular references
- **Version Mismatches**: Ensure compatible versions

#### Performance Issues
- **Large Datasets**: Use pagination for large prompt sets
- **Network Timeouts**: Check API response times
- **Database Load**: Monitor database performance

### Support Resources
- **Documentation**: This guide and related docs
- **API Documentation**: Swagger UI at `/api-docs`
- **Error Logs**: Check browser console and server logs
- **Technical Support**: Contact development team

## Future Enhancements

### Planned Features
- **Prompt Templates**: Reusable prompt templates
- **Version Comparison**: Side-by-side version comparison
- **Import/Export**: Bulk prompt import/export
- **Advanced Search**: Full-text search capabilities
- **Collaboration**: Multi-user editing with conflict resolution

### Integration Opportunities
- **CI/CD Integration**: Automated prompt deployment
- **Monitoring**: Real-time prompt performance monitoring
- **Analytics**: Prompt usage analytics and insights
- **A/B Testing**: Built-in prompt testing framework
