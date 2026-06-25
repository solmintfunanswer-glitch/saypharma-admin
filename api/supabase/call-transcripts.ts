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

    const endpoint = `${url}/rest/v1/call_transcripts?select=*&${filters.join("&")}`;

    const resp = await fetch(endpoint, { headers: h });
    const data = await resp.json();

    if (!resp.ok) { res.status(resp.status).json({ error: JSON.stringify(data) }); return; }
    res.json({ data });
  }
  