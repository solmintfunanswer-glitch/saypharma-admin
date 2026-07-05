import { Router, type IRouter } from "express";
import { supabaseConfig, supabaseHeaders } from "../../lib/supabase";

const router: IRouter = Router();

const ALLOWED_CREATE_FIELDS = [
  "name",
  "price",
  "active_substance",
  "form",
  "country",
  "age_category",
  "prescription_required",
  "dosage",
  "side_effects",
  "description",
  "image_url",
];

const ALLOWED_PATCH_FIELDS = [
  "name",
  "price",
  "active_substance",
  "form",
  "country",
  "age_category",
  "prescription_required",
  "dosage",
  "side_effects",
  "description",
  "image_url",
];

router.get("/supabase/products", async (_req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const resp = await fetch(`${url}/rest/v1/products?select=*&order=created_at.desc`, {
    headers: supabaseHeaders(key),
  });
  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json({ error: data });
    return;
  }
  res.json({ success: true, data });
});

router.post("/supabase/products", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const body: Record<string, unknown> = {};
  for (const k of ALLOWED_CREATE_FIELDS) {
    if (req.body && k in req.body) body[k] = req.body[k];
  }
  if (!body.name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const resp = await fetch(`${url}/rest/v1/products`, {
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

router.patch("/supabase/products/:id", async (req, res): Promise<void> => {
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

  const resp = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
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

router.delete("/supabase/products/:id", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const resp = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: supabaseHeaders(key),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    res.status(resp.status).json({ error: data });
    return;
  }
  res.status(204).end();
});

export default router;
