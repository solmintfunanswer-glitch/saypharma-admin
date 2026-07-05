import type { VercelRequest, VercelResponse } from "@vercel/node";

function headers() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, key, ok: !!url && !!key };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url, key, ok } = headers();
  if (!ok) return res.status(500).json({ error: "Missing env vars" });

  if (req.method === "GET") {
    const resp = await fetch(`${url}/rest/v1/pharmacy_settings?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data });
    return res.json({ success: true, data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
