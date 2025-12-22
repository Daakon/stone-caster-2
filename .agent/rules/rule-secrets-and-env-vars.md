---
trigger: always_on
---

You must never hardcode secrets, API keys, or other sensitive credentials in the source code. All such values must be loaded from environment variables. When adding a new environment variable, you must also add it to the corresponding `.env.example` file with a placeholder value.