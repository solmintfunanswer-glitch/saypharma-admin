export function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, key, ok: !!url && !!key };
}

export function supabaseHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}` };
}
