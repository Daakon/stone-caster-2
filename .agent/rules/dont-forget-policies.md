---
trigger: always_on
---

Any schema change that touches user-facing tables must include consideration of:
- RLS policies (do we need to add/modify?)
- grants/permissions (if applicable)
- how the frontend/back-end roles will access the data
