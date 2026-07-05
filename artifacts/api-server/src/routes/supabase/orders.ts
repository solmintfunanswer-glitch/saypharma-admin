import { Router, type IRouter } from "express";
import { supabaseConfig, supabaseHeaders } from "../../lib/supabase";

const router: IRouter = Router();

router.get("/supabase/orders", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const status = req.query.status as string | undefined;
  let query = `${url}/rest/v1/orders?select=*&order=created_at.desc`;
  if (status && status !== "all") query += `&status=eq.${encodeURIComponent(status)}`;

  const resp = await fetch(query, { headers: supabaseHeaders(key) });
  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json({ error: data });
    return;
  }
  res.json({ success: true, data });
});

router.post("/supabase/orders", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const {
    phone,
    first_name,
    last_name,
    full_name,
    items,
    total_amount,
    status,
    address,
    comment,
    payment_method,
    call_id,
  } = req.body ?? {};

  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }

  const body: Record<string, unknown> = {
    phone,
    first_name,
    last_name,
    full_name,
    items,
    total_amount,
    status: status ?? "new",
    address,
    comment,
    payment_method,
  };
  if (call_id) body.call_id = call_id;

  const resp = await fetch(`${url}/rest/v1/orders`, {
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
  res.status(201).json({ success: true, data: Array.isArray(data) ? data[0] : data });
});

router.patch("/supabase/orders/:id", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const allowed = ["status", "comment", "address", "payment_method"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in (req.body ?? {})) patch[k] = req.body[k];
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No valid fields" });
    return;
  }

  const resp = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
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

router.delete("/supabase/orders/:id", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const resp = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
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
