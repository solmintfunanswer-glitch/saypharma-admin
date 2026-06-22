import type { VercelRequest, VercelResponse } from "@vercel/node";

  const ALLOWED_FIELDS = ["name","active_substance","form","country","age_category",
    "prescription_required","dosage","side_effects","description","image_url"];

  export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(200).end(); return; }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { res.status(500).json({ error: "Missing env vars" }); return; }

    if (req.method === "GET") {
      const resp = await fetch(`${url}/rest/v1/products?select=*&order=created_at.desc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const data = await resp.json();
      if (!resp.ok) { res.status(resp.status).json({ error: data }); return; }
      res.json({ success: true, data });
      return;
    }

    if (req.method === "POST") {
      const body: Record<string, unknown> = {};
      for (const k of ALLOWED_FIELDS) { if (req.body && k in req.body) body[k] = req.body[k]; }
      if (!body.name) { res.status(400).json({ error: "name is required" }); return; }
      const resp = await fetch(`${url}/rest/v1/products`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) { res.status(resp.status).json({ error: data }); return; }
      res.status(201).json({ success: true, data });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  }
  