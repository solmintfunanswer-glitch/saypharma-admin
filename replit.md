# SayPharma Admin

Admin dashboard for a pharmacy delivery business (SayPharma) — manage settings, products/inventory, warehouse stock movements, orders, reports, and call history, backed by an external Supabase project.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 locally, mounted at `/api`)
- `pnpm --filter @workspace/saypharma-admin run dev` — run the frontend (Vite + React)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — the "vita-db1" Supabase project. All app data (settings, products, orders, stock_movements, stock_balance, stock_report, call_transcripts) lives there, not in a local Postgres DB.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite + React (`artifacts/saypharma-admin`), dark-themed single-page tab app (no client-side routing — a `useState` tab switch + `BottomNav`)
- API: Express 5 (`artifacts/api-server`), routes under `src/routes/supabase/*` proxy directly to the Supabase REST API using the service role key (raw `fetch`, not the Supabase JS client)
- No local DB / Drizzle usage — `lib/db` is unused by this app

## Where things live

- `artifacts/saypharma-admin/src/pages/` — Dashboard (settings), Products, Warehouse, Orders, Reports, CallHistory
- `artifacts/saypharma-admin/src/lib/api.ts` — typed fetch wrappers calling `/api/supabase/*`
- `artifacts/api-server/src/routes/supabase/` — Express routes mirroring the original Vercel serverless functions (settings, products, orders, stock-movements, stock-balance, stock-report, reset, call-transcripts)
- `artifacts/api-server/src/lib/supabase.ts` — shared Supabase REST helper (base URL + auth headers)

## Architecture decisions

- This was migrated from a working Vercel deployment (Vite + React + Vercel serverless functions, NOT Next.js despite the generic migration task assuming Next.js). The port was a straight logic copy: Vercel functions → Express routes, no redesign or restructuring.
- Supabase is accessed via raw REST calls with the service role key server-side only — the key never reaches the frontend.
- Frontend has no router; it's a single view with a bottom tab bar controlling which page component renders.

## Product

Pharmacy admin panel: configure pharmacy location/delivery radius/currency, manage a product catalog, record stock in/out/write-off/return movements, view current stock balance, manage incoming orders through a status pipeline, view stock/expiry reports, and browse call-agent transcripts linked to orders.

## User preferences

- User explicitly does not want framework conversions or restructuring when migrating an already-working app — only the minimum needed to run it on Replit (here: Vercel functions → Express, swap Supabase project).

## Gotchas

- When adding a new field to a Supabase-backed resource, update the field allowlist in **both** the POST (create) and PATCH (update) handlers in the corresponding `artifacts/api-server/src/routes/supabase/*.ts` file — they are separate allowlists and can silently drop fields if only one is updated.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
