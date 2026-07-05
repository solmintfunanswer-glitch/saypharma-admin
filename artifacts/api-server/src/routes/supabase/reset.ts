import { Router, type IRouter } from "express";
import { supabaseConfig, supabaseHeaders } from "../../lib/supabase";

const router: IRouter = Router();

router.delete("/supabase/reset", async (_req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const h = {
    ...supabaseHeaders(key),
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  const errors: string[] = [];

  for (const table of ["stock_movements", "orders", "products"]) {
    const resp = await fetch(`${url}/rest/v1/${table}?id=not.is.null`, {
      method: "DELETE",
      headers: h,
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      errors.push(`${table}: ${JSON.stringify(body)}`);
    }
  }

  if (errors.length > 0) {
    res.status(500).json({ error: errors.join("; ") });
    return;
  }
  res.json({ success: true });
});

export default router;
