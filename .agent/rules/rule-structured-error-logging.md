---
trigger: always_on
---
As a complement to `rule-api-response-consistency`, all errors handled in the backend services must be logged for observability and debugging.

1.  **Structured Logging**: All caught exceptions within a `service` file must be logged using a structured logger (if available) or as a JSON object to `console.error`.
2.  **Include Trace ID**: The log entry MUST include the `traceId` from the request's `meta` object. This allows for correlating a specific API response error with its corresponding backend logs.
3.  **Avoid Logging Secrets**: Ensure that sensitive information from the request body, headers, or environment variables (e.g., passwords, API keys) is stripped before logging.
4.  **Log at the Right Level**: Log handled, but unexpected, errors as `error`. Log informational events as `info` or `debug`.

**Example Error Log:**
`console.error(JSON.stringify({ level: 'error', message: 'User profile not found', userId: '...', traceId: '...' }));`
