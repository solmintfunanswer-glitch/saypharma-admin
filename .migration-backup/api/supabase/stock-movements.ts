import type { VercelRequest, VercelResponse } from "@vercel/node";

  const ALLOWED = ["product_id","type","quantity","purchase_price","purchase_price_vat","expiry_date","operation_date","notes"];

  export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(200).end(); return; }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { res.status(500).json({ error: "Missing env vars" }); return; }

    if (req.method === "GET") {
      const type = req.query.type as string | undefined;
      let q = `${url}/rest/v1/stock_movements?select=*,products(id,name,form)&order=operation_date.desc`;
      if (type && ["in","out","write_off"].includes(type)) q += `&type=eq.${type}`;
      const resp = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      const data = await resp.json();
      if (!resp.ok) { res.status(resp.status).json({ error: data }); return; }
      res.json({ success: true, data });
      return;
    }

    if (req.method === "POST") {
      const body: Record<string, unknown> = {};
      for (const k of ALLOWED) { if (req.body && k in req.body && req.body[k] !== "") body[k] = req.body[k]; }
      if (!body.product_id) { res.status(400).json({ error: "product_id is required" }); return; }
      if (!body.type || !["in","out","write_off"].includes(body.type as string)) {
        res.status(400).json({ error: "type must be in | out | write_off" }); return;
      }
      if (!body.quantity || Number(body.quantity) <= 0) {
        res.status(400).json({ error: "quantity must be > 0" }); return;
      }
      const resp = await fetch(`${url}/rest/v1/stock_movements`, {
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
  