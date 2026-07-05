
  import type { VercelRequest, VercelResponse } from "@vercel/node";

    export default async function handler(req: VercelRequest, res: VercelResponse) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") { res.status(200).end(); return; }
      if (req.method !== "DELETE") { res.status(405).json({ error: "Method not allowed" }); return; }

      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) { res.status(500).json({ error: "Missing env vars" }); return; }

      const h = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      };

      const errors: string[] = [];

      // Delete in dependency order: movements → orders → products
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

      const settingsResetValues = {
        latitude: 0,
        longitude: 0,
        delivery_radius_km: 0,
        delivery_fee: 0,
        min_order_amount: 0,
        max_requests_per_ip_per_day: 0,
        pharmacy_address: "",
        working_hours: "",
        phone1: "",
        phone2: "",
      };
      const settingsResp = await fetch(`${url}/rest/v1/pharmacy_settings?id=not.is.null`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify(settingsResetValues),
      });
      if (!settingsResp.ok) {
        const body = await settingsResp.json().catch(() => ({}));
        errors.push(`pharmacy_settings: ${JSON.stringify(body)}`);
      }

      if (errors.length > 0) {
        res.status(500).json({ error: errors.join("; ") });
        return;
      }
      res.json({ success: true });
    }
    