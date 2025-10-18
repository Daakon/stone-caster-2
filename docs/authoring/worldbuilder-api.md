# WorldBuilder API

## Overview

The WorldBuilder API provides secure REST endpoints for programmatic content operations. It enables automated document management, validation, preview assembly, and publishing workflows while maintaining strict access control and audit logging.

## Authentication

All API endpoints require authentication via JWT tokens. Include the token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

## Base URL

```
https://api.stonecaster.com/worldbuilder
```

## Endpoints

### Document Validation

#### POST /docs/validate

Validate a bundle of documents against all linters and validators.

**Request Body:**
```json
{
  "documents": {
    "world.forest_glade": {
      "doc_type": "world",
      "doc_ref": "world.forest_glade",
      "payload": {
        "id": "world.forest_glade",
        "name": "Forest Glade",
        "description": "A peaceful forest realm"
      },
      "format": "json"
    }
  },
  "options": {
    "strict": false,
    "includeWarnings": true,
    "includeInfo": false,
    "docTypes": []
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "diagnostics": [],
    "summary": {
      "errors": 0,
      "warnings": 0,
      "info": 0
    }
  },
  "message": "All documents valid"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "level": "error",
      "message": "Missing required field: name",
      "doc_ref": "world.forest_glade",
      "json_pointer": "/name",
      "code": "MISSING_REQUIRED_FIELD"
    }
  ]
}
```

### Document Upsert

#### POST /docs/upsert

Create or update draft documents. Only affects draft workspace.

**Request Body:**
```json
{
  "documents": {
    "world.forest_glade": {
      "doc_type": "world",
      "doc_ref": "world.forest_glade",
      "payload": {
        "id": "world.forest_glade",
        "name": "Forest Glade",
        "description": "A peaceful forest realm"
      },
      "format": "json"
    }
  },
  "workspace_id": "workspace-123",
  "notes": "Updated world description"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "doc_ref": "world.forest_glade",
      "doc_type": "world",
      "status": "upserted",
      "validation": {
        "errors": 0,
        "warnings": 0,
        "info": 0
      }
    }
  ],
  "message": "Upserted 1 documents successfully"
}
```

### Preview Assembly

#### POST /preview/assemble

Assemble AWF bundle for preview without mutating database.

**Request Body:**
```json
{
  "documents": {
    "world.forest_glade": {
      "doc_type": "world",
      "payload": {
        "id": "world.forest_glade",
        "name": "Forest Glade"
      },
      "format": "json"
    }
  },
  "session": {
    "sessionId": "preview-session",
    "turnId": 0,
    "nodeId": "node.start",
    "worldRef": "world.forest_glade",
    "adventureRef": "adv.herbal_journey",
    "playerProfile": {
      "name": "Test Player",
      "level": 1,
      "skills": { "combat": 50, "magic": 30 },
      "resources": { "hp": 100, "mana": 50 }
    },
    "gameState": {
      "hot": {},
      "cold": {}
    }
  },
  "options": {
    "includeWorld": true,
    "includeAdventure": true,
    "includeGraph": true,
    "includeSim": true,
    "includeParty": true,
    "includeEconomy": true,
    "includeLocalization": true,
    "tokenCap": 8000,
    "toolQuota": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bundle": {
      "version": "1.0.0",
      "session": { "id": "preview-session" },
      "world": { "id": "world.forest_glade", "name": "Forest Glade" },
      "adventure": null,
      "graph": null,
      "sim": null,
      "party": null,
      "economy": null,
      "localization": null
    },
    "tokenEstimate": 1000,
    "tokenBreakdown": {
      "world": 200,
      "adventure": 0,
      "graph": 0,
      "sim": 0,
      "party": 0,
      "economy": 0,
      "localization": 0
    },
    "slices": {
      "world": true,
      "adventure": false,
      "graph": false,
      "sim": false,
      "party": false,
      "economy": false,
      "localization": false
    },
    "warnings": [],
    "errors": []
  },
  "message": "Preview assembled successfully"
}
```

### Document Publishing

#### POST /publish

Publish a document with comprehensive validation gates.

**Request Body:**
```json
{
  "draftId": "draft-123",
  "docType": "world",
  "docRef": "world.forest_glade",
  "version": "1.0.0",
  "changelog": "Initial world creation with basic settings",
  "playtestReport": "playtest-report-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "hash": "abc123def456",
    "changelogPath": "changelogs/world/forest_glade/v1.0.0.md",
    "playtestReportPath": "playtest-reports/v1.0.0.json",
    "errors": [],
    "warnings": []
  },
  "message": "Document published successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Publish failed",
  "details": {
    "version": "",
    "hash": "",
    "changelogPath": "",
    "errors": ["Linter errors found", "Playtest verification failed"],
    "warnings": []
  }
}
```

### Reference Search

#### GET /refs/search

Search for document references with fuzzy matching.

**Query Parameters:**
- `q`: Search query (required)
- `options`: JSON string with search options

**Example:**
```http
GET /refs/search?q=forest&options={"includeTypes":["world","adventure"],"maxResults":10,"fuzzy":true}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "world.forest_glade",
      "type": "world",
      "name": "Forest Glade",
      "description": "A peaceful forest realm",
      "relevance": 100
    },
    {
      "id": "adv.forest_exploration",
      "type": "adventure",
      "name": "Forest Exploration",
      "description": "Explore the forest depths",
      "relevance": 80
    }
  ],
  "message": "Found 2 references"
}
```

### Document References

#### GET /refs/:docId

Get cross-references for a specific document.

**Response:**
```json
{
  "success": true,
  "data": {
    "references": [
      {
        "id": "world.forest_glade",
        "type": "world",
        "location": "adv.herbal_journey",
        "json_pointer": "/world_ref",
        "context": "world.forest_glade"
      }
    ],
    "referencing": [
      "adv.herbal_journey",
      "adv.forest_exploration"
    ]
  },
  "message": "Found 1 references and 2 referencing documents"
}
```

### Health Check

#### GET /health

Check API health and status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-27T15:30:00Z",
    "version": "1.0.0"
  },
  "message": "WorldBuilder API is healthy"
}
```

### Statistics

#### GET /stats

Get API usage statistics (admin only).

**Response:**
```json
{
  "success": true,
  "data": {
    "total_documents": 150,
    "total_drafts": 25,
    "total_published": 125,
    "validation_errors": 5,
    "validation_warnings": 12,
    "last_activity": "2024-01-27T15:30:00Z"
  },
  "message": "Statistics retrieved successfully"
}
```

## Error Handling

### Standard Error Response

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error details"
}
```

### HTTP Status Codes

- `200`: Success
- `400`: Bad Request (invalid data)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

### Common Errors

#### Validation Errors
```json
{
  "success": false,
  "error": "Document validation failed",
  "details": [
    {
      "level": "error",
      "message": "Missing required field: name",
      "doc_ref": "world.forest_glade",
      "json_pointer": "/name",
      "code": "MISSING_REQUIRED_FIELD"
    }
  ]
}
```

#### Permission Errors
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "required_roles": ["editor", "admin"]
}
```

#### Rate Limiting
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "details": "Too many requests. Try again in 60 seconds."
}
```

## Rate Limiting

- **Standard Users**: 100 requests per minute
- **Editors**: 500 requests per minute
- **Admins**: 1000 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Authentication & Authorization

### Roles

- **Author**: Can create and edit drafts, validate documents
- **Editor**: Can publish documents, manage workspaces
- **Admin**: Full access to all operations and statistics

### Permissions Matrix

| Operation | Author | Editor | Admin |
|-----------|--------|--------|-------|
| Validate | ✓ | ✓ | ✓ |
| Upsert | ✓ | ✓ | ✓ |
| Preview | ✓ | ✓ | ✓ |
| Publish | ✗ | ✓ | ✓ |
| Search | ✓ | ✓ | ✓ |
| Stats | ✗ | ✗ | ✓ |

## Examples

### Complete Workflow

```bash
# 1. Create draft document
curl -X POST https://api.stonecaster.com/worldbuilder/docs/upsert \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": {
      "world.forest_glade": {
        "doc_type": "world",
        "doc_ref": "world.forest_glade",
        "payload": {
          "id": "world.forest_glade",
          "name": "Forest Glade",
          "description": "A peaceful forest realm"
        },
        "format": "json"
      }
    }
  }'

# 2. Validate document
curl -X POST https://api.stonecaster.com/worldbuilder/docs/validate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": {
      "world.forest_glade": {
        "doc_type": "world",
        "doc_ref": "world.forest_glade",
        "payload": {
          "id": "world.forest_glade",
          "name": "Forest Glade",
          "description": "A peaceful forest realm"
        },
        "format": "json"
      }
    }
  }'

# 3. Generate preview
curl -X POST https://api.stonecaster.com/worldbuilder/preview/assemble \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": {
      "world.forest_glade": {
        "doc_type": "world",
        "payload": {
          "id": "world.forest_glade",
          "name": "Forest Glade"
        },
        "format": "json"
      }
    },
    "session": {
      "sessionId": "preview-session",
      "turnId": 0,
      "nodeId": "node.start",
      "worldRef": "world.forest_glade",
      "adventureRef": "adv.herbal_journey",
      "playerProfile": {
        "name": "Test Player",
        "level": 1,
        "skills": {},
        "resources": {}
      },
      "gameState": { "hot": {}, "cold": {} }
    }
  }'

# 4. Publish document
curl -X POST https://api.stonecaster.com/worldbuilder/publish \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "draftId": "draft-123",
    "docType": "world",
    "docRef": "world.forest_glade",
    "version": "1.0.0",
    "changelog": "Initial world creation"
  }'
```

### Batch Operations

```bash
# Validate multiple documents
curl -X POST https://api.stonecaster.com/worldbuilder/docs/validate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": {
      "world.forest_glade": { "doc_type": "world", "payload": {...} },
      "adv.herbal_journey": { "doc_type": "adventure", "payload": {...} },
      "graph.herbal_journey": { "doc_type": "quest_graph", "payload": {...} }
    }
  }'
```

### Search and Discovery

```bash
# Search for forest-related content
curl -X GET "https://api.stonecaster.com/worldbuilder/refs/search?q=forest" \
  -H "Authorization: Bearer <token>"

# Get references for a specific document
curl -X GET https://api.stonecaster.com/worldbuilder/refs/world.forest_glade \
  -H "Authorization: Bearer <token>"
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { WorldBuilderAPI } from '@stonecaster/worldbuilder-api';

const api = new WorldBuilderAPI({
  baseURL: 'https://api.stonecaster.com/worldbuilder',
  token: 'your-jwt-token'
});

// Validate documents
const validation = await api.validateDocuments({
  documents: {
    'world.forest_glade': {
      doc_type: 'world',
      payload: { id: 'world.forest_glade', name: 'Forest Glade' },
      format: 'json'
    }
  }
});

// Generate preview
const preview = await api.assemblePreview({
  documents: { /* ... */ },
  session: { /* ... */ }
});

// Publish document
const publish = await api.publishDocument({
  draftId: 'draft-123',
  docType: 'world',
  docRef: 'world.forest_glade',
  version: '1.0.0',
  changelog: 'Initial creation'
});
```

### Python

```python
import requests

class WorldBuilderAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def validate_documents(self, documents):
        response = requests.post(
            f'{self.base_url}/docs/validate',
            json={'documents': documents},
            headers=self.headers
        )
        return response.json()
    
    def assemble_preview(self, documents, session):
        response = requests.post(
            f'{self.base_url}/preview/assemble',
            json={'documents': documents, 'session': session},
            headers=self.headers
        )
        return response.json()

# Usage
api = WorldBuilderAPI('https://api.stonecaster.com/worldbuilder', 'your-token')
result = api.validate_documents(documents)
```

## Monitoring and Observability

### Metrics

The API exposes metrics for monitoring:

- `awf.author.validate_ms`: Validation duration
- `awf.author.preview_ms`: Preview assembly duration
- `awf.author.publish_ms`: Publish duration
- `awf.author.validator_errors`: Validation error count
- `awf.author.validator_warnings`: Validation warning count
- `awf.author.playtest_runs`: Playtest execution count

### Audit Logging

All operations are logged for audit purposes:

- Document creation/updates
- Validation runs
- Preview generations
- Publish operations
- Search queries

### Health Checks

Use the `/health` endpoint for monitoring:

```bash
curl https://api.stonecaster.com/worldbuilder/health
```

## Security Considerations

### Input Validation

- All input is validated against schemas
- JSON/YAML parsing is sanitized
- File size limits enforced (512KB per document)
- Rate limiting prevents abuse

### Access Control

- JWT tokens required for all operations
- Role-based permissions enforced
- Workspace isolation for team collaboration
- Audit logging for all actions

### Data Protection

- Documents encrypted at rest
- Secure transmission (HTTPS only)
- No sensitive data in logs
- Regular security audits


