---
trigger: always_on
---

You are working inside the StoneCaster project.

Architecture:
- Frontend: Cloudflare Workers, Vite, React, TypeScript
- Backend: Node.js (Fly.io deployment)
- Auth & DB: Supabase (Postgres, RLS enabled)
- API style: REST (scalar-style), not GraphQL
- No heavy framework magic; prefer explicit logic

Never invent new infrastructure, services, or providers unless explicitly asked.
