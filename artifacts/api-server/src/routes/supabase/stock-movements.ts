import { Router, type IRouter } from "express";
import { supabaseConfig, supabaseHeaders } from "../../lib/supabase";

const router: IRouter = Router();

const ALLOWED_FIELDS = [
  "product_id",
  "type",
  "quantity",
  "purchase_price",
  "purchase_price_vat",
  "expiry_date",
  "operation_date",
  "notes",
];

router.get("/supabase/stock-movements", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const type = req.query.type as string | undefined;
  let q = `${url}/rest/v1/stock_movements?select=*,products(id,name,form)&order=operation_date.desc`;
  if (type && ["in", "out", "write_off"].includes(type)) q += `&type=eq.${type}`;

  const resp = await fetch(q, { headers: supabaseHeaders(key) });
  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json({ error: data });
    return;
  }
  res.json({ success: true, data });
});

router.post("/supabase/stock-movements", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const body: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (req.body && k in req.body && req.body[k] !== "") body[k] = req.body[k];
  }
  if (!body.product_id) {
    res.status(400).json({ error: "product_id is required" });
    return;
  }
  if (!body.type || !["in", "out", "write_off"].includes(body.type as string)) {
    res.status(400).json({ error: "type must be in | out | write_off" });
    return;
  }
  if (!body.quantity || Number(body.quantity) <= 0) {
    res.status(400).json({ error: "quantity must be > 0" });
    return;
  }

  const resp = await fetch(`${url}/rest/v1/stock_movements`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json({ error: data });
    return;
  }
  res.status(201).json({ success: true, data });
});

router.delete("/supabase/stock-movements/:id", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const resp = await fetch(`${url}/rest/v1/stock_movements?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: supabaseHeaders(key),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    res.status(resp.status).json({ error: data });
    return;
  }
  res.json({ success: true });
});

export default router;
