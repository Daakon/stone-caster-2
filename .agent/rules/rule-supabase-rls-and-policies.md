---
trigger: always_on
description: "Combined rule for Supabase Row Level Security (RLS) and data access policies."
---
This project uses Supabase with Row Level Security (RLS) enabled. All database changes and queries must be made with this in mind.

When proposing any database schema change, query, or data access pattern, you MUST consider its security implications:

1.  **RLS Policy Impact**: Any change to a table that stores user data (or is linked to user data) requires a review of the corresponding RLS policies. Do existing policies cover the change? Do new policies need to be created?
2.  **Access Roles**: Always consider the difference between `anon`, `authenticated`, and `service_role` access. Queries from the backend running with the `service_role` key bypass RLS by default, while queries made from the frontend client are subject to the user's role.
3.  **Grants and Permissions**: Ensure that the appropriate roles have the necessary (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) permissions on the tables and columns they need to access.
4.  **Migrations**: Database migrations must preserve the security posture. Never create a migration that disables RLS or grants overly broad permissions.
