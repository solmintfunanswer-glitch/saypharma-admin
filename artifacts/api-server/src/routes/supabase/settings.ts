import { Router, type IRouter } from "express";
import { supabaseConfig, supabaseHeaders } from "../../lib/supabase";

const router: IRouter = Router();

const ALLOWED_PATCH_FIELDS = [
  "latitude",
  "longitude",
  "delivery_radius_km",
  "max_requests_per_ip_per_day",
  "delivery_fee",
  "min_order_amount",
  "working_hours",
  "currency",
  "pharmacy_address",
  "phone1",
  "phone2",
];

router.get("/supabase/settings", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const resp = await fetch(`${url}/rest/v1/pharmacy_settings?select=*&limit=1`, {
    headers: supabaseHeaders(key),
  });
  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json({ error: data });
    return;
  }
  res.json({ success: true, data });
});

router.patch("/supabase/settings/:id", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED_PATCH_FIELDS) {
    if (k in (req.body ?? {})) patch[k] = req.body[k];
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No valid fields" });
    return;
  }

  const resp = await fetch(`${url}/rest/v1/pharmacy_settings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });
  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json({ error: data });
    return;
  }
  res.json({ success: true, data });
});

export default router;
