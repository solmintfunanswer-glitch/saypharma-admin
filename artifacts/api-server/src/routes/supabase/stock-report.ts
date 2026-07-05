import { Router, type IRouter } from "express";
import { supabaseConfig, supabaseHeaders } from "../../lib/supabase";

const router: IRouter = Router();

router.get("/supabase/stock-report", async (_req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const resp = await fetch(`${url}/rest/v1/stock_report?select=*&order=name.asc`, {
    headers: supabaseHeaders(key),
  });
  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json({ error: data });
    return;
  }
  res.json({ success: true, data });
});

export default router;
