---
trigger: always_on
---

## Service Error Taxonomy

Use strict, typed errors in the Service layer. Do not throw generic \Error\.

### Standard Error Classes
Extend \ServiceError\ (base class):
- \ValidationError\: Input does not meet domain rules (maps to 400).
- \NotFoundError\: Resource not found (maps to 404).
- \PermissionError\: User lacks ownership/role (maps to 403).
- \ConflictError\: Unique constraint or state conflict (maps to 409).
- \InternalError\: Unexpected system failures (maps to 500).

### Route Mapping
Use \sendErrorWithStatus\ helper to map these caught errors to HTTP codes automatically.

\\\	ypescript
try {
  await service.action();
} catch (err) {
  if (err instanceof NotFoundError) return sendErrorWithStatus(res, 404, err.message);
  // ...
}
\\\
"@),

    @("c:\Dev\Stone Caster\stone-caster-2\.agent\rules\rule-api-response-discipline.md", @"
---
trigger: always_on
---

## API Response Discipline

### 1. Consistent Envelopes
All responses must use the standard envelope:
- **Success**: \{ success: true, data: T, meta?: any }\
- **Error**: \{ success: false, error: { message: string, code?: string } }\

### 2. DTO Locations
- Define Request/Response DTOs in \@shared/src/types/chimera-*.ts\.
- Do NOT define types inline in route files.

### 3. Payload Requirements
- Return only what the UI needs. Avoid \select *\ leaks.
- For list endpoints, support pagination/cursors if dataset > 50 items.
- For \"global\" endpoints (configs, presets), implement ETags or Cache-Control headers where possible.
