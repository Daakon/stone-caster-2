# API Documentation Standards

This document establishes the standards for maintaining Swagger/OpenAPI documentation as the single source of truth for the StoneCaster API.

## 🎯 Goals

- **Source of Truth**: Swagger documentation is the authoritative reference for API structure
- **AI-Friendly**: Comprehensive documentation enables AI assistants to make informed decisions
- **Automated Validation**: Continuous validation ensures documentation stays current
- **Developer Experience**: Clear, consistent documentation improves development workflow

## 📋 Documentation Requirements

### 1. Route Documentation

Every API route MUST have Swagger documentation with the following elements:

```typescript
/**
 * @swagger
 * /api/endpoint:
 *   get:
 *     summary: Brief description of what this endpoint does
 *     description: Detailed description of the endpoint's purpose and behavior
 *     tags: [TagName]
 *     security:
 *       - BearerAuth: []
 *       - GuestCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Resource identifier
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ResourceType'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
```

### 2. Required Elements

#### Summary
- **Required**: Yes
- **Format**: Brief, descriptive sentence
- **Example**: "Get character by ID"

#### Description
- **Required**: Yes
- **Format**: Detailed explanation of endpoint behavior
- **Example**: "Retrieves a specific character by its UUID, including all character data and stats"

#### Tags
- **Required**: Yes
- **Format**: Array of strings
- **Purpose**: Groups related endpoints
- **Examples**: `[Characters]`, `[Admin]`, `[Authentication]`

#### Security
- **Required**: Yes (for protected endpoints)
- **Options**: `BearerAuth`, `GuestCookie`
- **Example**: 
  ```yaml
  security:
    - BearerAuth: []
    - GuestCookie: []
  ```

#### Parameters
- **Required**: For path and query parameters
- **Format**: OpenAPI parameter specification
- **Types**: `path`, `query`, `header`, `cookie`

#### Request Body
- **Required**: For POST, PUT, PATCH endpoints
- **Format**: OpenAPI request body specification
- **Content-Type**: `application/json`

#### Responses
- **Required**: Yes
- **Minimum**: 200/201 success, 400/401/500 error responses
- **Format**: OpenAPI response specification

### 3. Schema Definitions

All data types MUST be defined in the `components/schemas` section:

```typescript
// In swagger.ts
components: {
  schemas: {
    Character: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174000'
        },
        name: {
          type: 'string',
          example: 'Thorne Shifter'
        },
        // ... more properties
      }
    }
  }
}
```

### 4. Error Handling

All endpoints MUST document error responses:

```yaml
responses:
  400:
    description: Validation error
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
  401:
    description: Unauthorized
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
  500:
    description: Internal server error
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
```

## 🔧 Automation Tools

### 1. Validation Script

```bash
# Validate all API documentation
npm run docs:validate

# Check specific route files
tsx scripts/validate-api-docs.ts
```

### 2. Auto-Generation

```bash
# Generate missing documentation
npm run docs:generate

# Generate OpenAPI specification
npm run docs:spec
```

### 3. CI/CD Integration

```bash
# Pre-commit checks
npm run docs:ci pre-commit

# Post-merge updates
npm run docs:ci post-merge
```

## 📊 Quality Metrics

### Coverage Requirements

- **100% Route Coverage**: All routes must have Swagger documentation
- **100% Schema Coverage**: All data types must be defined
- **100% Error Coverage**: All error responses must be documented

### Validation Checks

1. **Route Documentation**: Every `router.get/post/put/delete` has `@swagger` comment
2. **Tag Assignment**: Every route has appropriate tags
3. **Parameter Documentation**: All path/query parameters documented
4. **Response Documentation**: All response codes documented
5. **Schema Completeness**: All referenced schemas exist

## 🚀 Workflow Integration

### 1. Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
cd backend
npm run docs:validate
if [ $? -ne 0 ]; then
  echo "❌ API documentation validation failed"
  exit 1
fi
```

### 2. CI/CD Pipeline

The GitHub Actions workflow automatically:
- Validates documentation on PR
- Generates OpenAPI spec
- Comments on PRs with API status
- Auto-generates missing docs on main branch

### 3. Development Workflow

1. **Create Route**: Add new route handler
2. **Add Documentation**: Include Swagger comment above route
3. **Validate**: Run `npm run docs:validate`
4. **Commit**: Documentation validation passes
5. **Deploy**: CI/CD ensures documentation stays current

## 📚 AI Integration

### For AI Assistants

The Swagger documentation serves as the authoritative source for:

1. **API Structure**: Complete endpoint definitions
2. **Data Models**: All request/response schemas
3. **Authentication**: Security requirements
4. **Error Handling**: Expected error responses
5. **Examples**: Sample requests and responses

### Usage Examples

```typescript
// AI can reference the Swagger spec to understand:
// - Available endpoints
// - Required parameters
// - Expected responses
// - Authentication requirements
// - Error handling patterns
```

## 🔍 Monitoring and Maintenance

### 1. Regular Validation

- **Daily**: CI/CD pipeline validates on every commit
- **Weekly**: Manual review of documentation quality
- **Monthly**: Full API contract review

### 2. Change Detection

The system automatically detects:
- New routes without documentation
- Modified routes with outdated documentation
- Missing schema definitions
- Inconsistent error handling

### 3. Quality Metrics

Track these metrics:
- Documentation coverage percentage
- Number of undocumented routes
- Schema completeness score
- Error response coverage

## 📖 Best Practices

### 1. Documentation Style

- **Consistent**: Use same format across all endpoints
- **Descriptive**: Clear, detailed descriptions
- **Examples**: Include realistic examples
- **Complete**: Document all parameters and responses

### 2. Schema Design

- **Reusable**: Define common schemas once
- **Typed**: Use proper OpenAPI types
- **Validated**: Include validation rules
- **Examples**: Provide sample values

### 3. Error Handling

- **Consistent**: Use standard error schemas
- **Complete**: Document all possible errors
- **Descriptive**: Clear error descriptions
- **Actionable**: Include resolution guidance

## 🎯 Success Criteria

The API documentation system is successful when:

1. **100% Coverage**: All routes documented
2. **Zero Validation Errors**: All checks pass
3. **AI-Friendly**: AI assistants can make informed decisions
4. **Developer-Friendly**: Clear, helpful documentation
5. **Automated**: Minimal manual maintenance required
6. **Current**: Always up-to-date with code changes

## 🔧 Troubleshooting

### Common Issues

1. **Missing Documentation**
   ```bash
   npm run docs:generate
   ```

2. **Validation Errors**
   ```bash
   npm run docs:validate
   ```

3. **Schema Issues**
   - Check schema definitions in `swagger.ts`
   - Ensure all referenced schemas exist

4. **CI/CD Failures**
   - Review GitHub Actions logs
   - Check for missing dependencies
   - Verify script permissions

### Getting Help

- **Documentation**: This guide
- **Scripts**: `backend/scripts/` directory
- **Validation**: `npm run docs:validate`
- **Generation**: `npm run docs:generate`

---

**Remember**: Swagger documentation is the single source of truth for your API. Keep it current, complete, and comprehensive to enable AI assistants and developers to work effectively with your API.
