import type { VercelRequest, VercelResponse } from "@vercel/node";

function headers() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, key, ok: !!url && !!key };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url, key, ok } = headers();
  if (!ok) return res.status(500).json({ error: "Missing env vars" });

  const id = req.query.id as string;

  if (req.method === "DELETE") {
    const resp = await fetch(
      `${url}/rest/v1/stock_movements?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: data });
    }
    return res.json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
