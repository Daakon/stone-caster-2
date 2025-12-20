---
trigger: always_on
---

All API responses must adhere to a consistent structure. Successful responses (`2xx`) should have a predictable shape. Error responses (`4xx`, `5xx`) must return a JSON object with a `{ success: false, error: { message: '...' } }` structure. Do not expose raw database errors or stack traces to the client.