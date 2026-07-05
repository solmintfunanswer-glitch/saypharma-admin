import type { VercelRequest, VercelResponse } from "@vercel/node";

function headers() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, key, ok: !!url && !!key };
}

const ALLOWED_TYPES = ["in", "out", "write_off", "return"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url, key, ok } = headers();
  if (!ok) return res.status(500).json({ error: "Missing env vars" });

  if (req.method === "GET") {
    const typeFilter = req.query.type as string | undefined;
    let query = `${url}/rest/v1/stock_movements?select=*,products(id,name,form)&order=operation_date.desc`;
    if (typeFilter && ALLOWED_TYPES.includes(typeFilter)) {
      query += `&type=eq.${encodeURIComponent(typeFilter)}`;
    }
    const resp = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data });
    return res.json({ success: true, data });
  }

  if (req.method === "POST") {
    const allowed = ["product_id", "type", "quantity", "purchase_price",
      "purchase_price_vat", "expiry_date", "operation_date", "notes"];
    const body: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in (req.body ?? {}) && req.body[k] !== "") body[k] = req.body[k];
    }
    if (!body.product_id) return res.status(400).json({ error: "product_id is required" });
    if (!body.type || !ALLOWED_TYPES.includes(body.type as string)) {
      return res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(" | ")}` });
    }
    if (!body.quantity || Number(body.quantity) <= 0) {
      return res.status(400).json({ error: "quantity must be > 0" });
    }

    const resp = await fetch(`${url}/rest/v1/stock_movements`, {
      method: "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        "Content-Type": "application/json", Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data });
    return res.status(201).json({ success: true, data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
