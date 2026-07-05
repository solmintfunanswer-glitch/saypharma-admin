---
name: Supabase-proxy allowlist bug pattern
description: When an Express backend proxies Supabase REST with separate field allowlists for create vs update, they drift independently and silently drop fields.
---

When porting Vercel serverless functions that proxy Supabase's REST API
(pattern: `fetch(supabaseUrl + "/rest/v1/<table>", { headers: { apikey,
Authorization } })`), create (POST) and update (PATCH) handlers each define
their own field allowlist to whitelist which request-body keys get forwarded.

These two allowlists are maintained independently and can drift: a field
present in the PATCH allowlist can be missing from the POST allowlist (or
vice versa), silently dropping it on create while update works fine. There is
no type error or runtime error — the Supabase insert just omits the field and
the DB default (often `0` or `null`) is used instead.

**Why:** Found via e2e testing — the frontend "Add Product" form sent `price`
correctly, but the created product listed price `0.00` because the POST
allowlist in the Express route omitted `"price"` while the PATCH allowlist
included it.

**How to apply:** When migrating or reviewing this proxy pattern, diff the
create and update allowlists field-by-field. When e2e testing CRUD flows
against this pattern, always test **create**, not just update — bugs here
hide specifically in the create path since it's the one allowlist that can be
copy-paste-forgotten.
