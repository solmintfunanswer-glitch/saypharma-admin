import { Router, type IRouter } from "express";
import { supabaseConfig, supabaseHeaders } from "../../lib/supabase";

const router: IRouter = Router();

router.get("/supabase/call-transcripts", async (req, res): Promise<void> => {
  const { url, key, ok } = supabaseConfig();
  if (!ok) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const h = supabaseHeaders(key);
  const { phone, client_name, date_from, date_to } = req.query as Record<string, string>;

  const filters: string[] = ["order=called_at.desc"];
  if (phone) filters.push(`phone=ilike.*${encodeURIComponent(phone)}*`);
  if (client_name) filters.push(`client_name=ilike.*${encodeURIComponent(client_name)}*`);
  if (date_from) filters.push(`called_at=gte.${date_from}`);
  if (date_to) filters.push(`called_at=lte.${date_to}T23:59:59`);

  const resp = await fetch(`${url}/rest/v1/call_transcripts?select=*&${filters.join("&")}`, { headers: h });
  const transcripts = (await resp.json()) as Record<string, unknown>[];
  if (!resp.ok) {
    res.status(resp.status).json({ error: JSON.stringify(transcripts) });
    return;
  }

  const callIds = [...new Set(transcripts.map((t) => t.call_id as string).filter(Boolean))];
  const orderIds = [...new Set(transcripts.map((t) => t.order_id as string).filter(Boolean))];

  let orders: Record<string, unknown>[] = [];

  if (callIds.length > 0 || orderIds.length > 0) {
    const orParts: string[] = [];
    if (callIds.length > 0) orParts.push(`call_id.in.(${callIds.join(",")})`);
    if (orderIds.length > 0) orParts.push(`id.in.(${orderIds.join(",")})`);

    const oResp = await fetch(
      `${url}/rest/v1/orders?select=id,status,total_amount,call_id&or=(${orParts.join(",")})`,
      { headers: h },
    );
    if (oResp.ok) orders = (await oResp.json()) as Record<string, unknown>[];
  }

  const byCallId = new Map(orders.filter((o) => o.call_id).map((o) => [o.call_id, o]));
  const byId = new Map(orders.map((o) => [o.id, o]));

  const enriched = transcripts.map((t) => ({
    ...t,
    order: byCallId.get(t.call_id as string) ?? byId.get(t.order_id as string) ?? null,
  }));

  res.json({ data: enriched });
});

export default router;
