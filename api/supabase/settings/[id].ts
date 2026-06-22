import type { VercelRequest, VercelResponse } from "@vercel/node";

  const ALLOWED = ["latitude", "longitude", "delivery_radius_km", "max_requests_per_ip_per_day"];

  export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(200).end(); return; }
    if (req.method !== "PATCH") { res.status(405).json({ error: "Method not allowed" }); return; }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { res.status(500).json({ error: "Missing env vars" }); return; }

    const { id } = req.query as { id: string };
    const patch: Record<string, unknown> = {};
    for (const k of ALLOWED) {
      if (req.body && k in req.body) patch[k] = req.body[k];
    }
    if (!Object.keys(patch).length) { res.status(400).json({ error: "No valid fields" }); return; }

    const resp = await fetch(
      `${url}/rest/v1/pharmacy_settings?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch),
      }
    );
    const data = await resp.json();
    if (!resp.ok) { res.status(resp.status).json({ error: data }); return; }
    res.json({ success: true, data });
  }
  