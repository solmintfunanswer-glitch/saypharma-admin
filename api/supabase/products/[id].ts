import type { VercelRequest, VercelResponse } from "@vercel/node";

  export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") { res.status(200).end(); return; }
    if (req.method !== "DELETE") { res.status(405).json({ error: "Method not allowed" }); return; }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { res.status(500).json({ error: "Missing env vars" }); return; }

    const { id } = req.query as { id: string };
    const resp = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!resp.ok) { const data = await resp.json().catch(() => ({})); res.status(resp.status).json({ error: data }); return; }
    res.json({ success: true });
  }
  