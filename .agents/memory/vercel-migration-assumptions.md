---
name: Vercel/v0 migration assumptions
description: The generic "migrate from Vercel" task template assumes Next.js by default — always verify actual framework before converting.
---

The auto-generated Vercel/v0 migration task instructs the agent to convert the
imported project from Next.js to Vite + React, assuming Next.js is the
framework. This assumption can be wrong: a project may already be Vite +
React with Vercel serverless functions (`api/*.ts`) calling an external
service (e.g. Supabase REST API) directly, with no Next.js involved at all.

**Why:** Blindly following the task template's Next.js-conversion steps on an
already-Vite app would mean unnecessary, unwanted restructuring of a working
app — a real regression risk for a live product the user depends on.

**How to apply:** Before starting any Vercel/v0 migration, inspect the actual
code (`package.json` deps, presence of `next.config.*` vs `vite.config.*`,
`app/`/`pages/` vs `src/`) rather than trusting the task description's
framework assumption. If the app is already Vite + React, treat the task as:
port Vercel serverless functions (`api/*.ts`) into Express as a straight
logic copy, and do nothing else — no redesign, no restructuring. Confirm this
scope explicitly with the user if the task description contradicts what you
observe in the code.
