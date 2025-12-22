---
trigger: always_on
---

Routes must not access Supabase clients or run queries.

# Allowed
- Parsing input (Zod schemas)
- Checking authentication / roles
- Calling a single Service method
- Mapping Service errors to HTTP responses

# Forbidden
- \supabaseAdmin.*\ usage
- \supabase.*\ usage
- \.from('table')\ calls in route handlers
- Raw SQL execution
- Transaction management in routes

# Enforcement
Grep for these patterns in \ackend/src/routes/**\:
- \supabaseAdmin\
- \.from(\
- \.rpc(\

All DB access belongs in Repository modules (\ackend/src/db/repos/**\).
