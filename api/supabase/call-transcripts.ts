import type { VercelRequest, VercelResponse } from "@vercel/node";

  export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(200).end(); return; }
    if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { res.status(500).json({ error: "Missing env vars" }); return; }

    const h = { apikey: key, Authorization: `Bearer ${key}` };
    const { phone, client_name, date_from, date_to } = req.query as Record<string, string>;

    const filters: string[] = ["order=called_at.desc"];
    if (phone)       filters.push(`phone=ilike.*${encodeURIComponent(phone)}*`);
    if (client_name) filters.push(`client_name=ilike.*${encodeURIComponent(client_name)}*`);
    if (date_from)   filters.push(`called_at=gte.${date_from}`);
    if (date_to)     filters.push(`called_at=lte.${date_to}T23:59:59`);

    const resp = await fetch(`${url}/rest/v1/call_transcripts?select=*&${filters.join("&")}`, { headers: h });
    const transcripts: Record<string, unknown>[] = await resp.json();
    if (!resp.ok) { res.status(resp.status).json({ error: JSON.stringify(transcripts) }); return; }

    // Collect identifiers for batch order lookup
    const callIds  = [...new Set(transcripts.map(t => t.call_id  as string).filter(Boolean))];
    const orderIds = [...new Set(transcripts.map(t => t.order_id as string).filter(Boolean))];

    let orders: Record<string, unknown>[] = [];

    if (callIds.length > 0 || orderIds.length > 0) {
      const orParts: string[] = [];
      if (callIds.length  > 0) orParts.push(`call_id.in.(${callIds.join(",")})`);
      if (orderIds.length > 0) orParts.push(`id.in.(${orderIds.join(",")})`);

      const oResp = await fetch(
        `${url}/rest/v1/orders?select=id,status,total_amount,call_id&or=(${orParts.join(",")})`,
        { headers: h }
      );
      if (oResp.ok) orders = await oResp.json();
    }

    // Index orders by call_id and by id for O(1) lookup
    const byCallId = new Map(orders.filter(o => o.call_id).map(o => [o.call_id, o]));
    const byId     = new Map(orders.map(o => [o.id, o]));

    const enriched = transcripts.map(t => ({
      ...t,
      order: byCallId.get(t.call_id as string)
          ?? byId.get(t.order_id as string)
          ?? null,
    }));

    res.json({ data: enriched });
  }
  