import { createClient, SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "saypharma_supabase_config";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function getStoredConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SupabaseConfig;
  } catch {
    return null;
  }
}

export function storeConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const TABLE_NAME = "pharmacy_settings";

export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude DECIMAL(10, 8) NOT NULL DEFAULT 0,
  longitude DECIMAL(11, 8) NOT NULL DEFAULT 0,
  delivery_radius_km DECIMAL(8, 2) NOT NULL DEFAULT 5.0,
  max_requests_per_ip_per_day INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_pharmacy_settings_updated_at ON ${TABLE_NAME};
CREATE TRIGGER update_pharmacy_settings_updated_at
  BEFORE UPDATE ON ${TABLE_NAME}
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
`;

export interface PharmacySettings {
  id: string;
  latitude: number;
  longitude: number;
  delivery_radius_km: number;
  max_requests_per_ip_per_day: number;
  created_at: string;
  updated_at: string;
}
