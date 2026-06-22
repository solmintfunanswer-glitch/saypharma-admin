import { useState } from "react";
import { createSupabaseClient, storeConfig, TABLE_NAME, type SupabaseConfig } from "@/lib/supabase";

interface Props {
  onComplete: () => void;
}

type Step = "credentials" | "testing" | "done";

export default function Setup({ onComplete }: Props) {
  const [form, setForm] = useState<SupabaseConfig>({
    url: "",
    anonKey: "",
    serviceRoleKey: "",
  });
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  const handleConnect = async () => {
    if (!form.url || !form.anonKey || !form.serviceRoleKey) {
      setError("Все три поля обязательны");
      return;
    }
    if (!form.url.startsWith("https://")) {
      setError("SUPABASE_URL должен начинаться с https://");
      return;
    }

    setError(null);
    setStep("testing");
    setLog([]);

    try {
      addLog("Создаю клиент Supabase...");
      const client = createSupabaseClient(form);

      addLog("Проверяю подключение...");
      const { error: pingError } = await client.from("_nonexistent_ping_test_").select("*").limit(0);
      if (pingError && pingError.code !== "42P01" && !pingError.message.includes("does not exist")) {
        throw new Error(`Ошибка подключения: ${pingError.message}`);
      }
      addLog("✓ Подключение успешно");

      addLog("Создаю таблицу pharmacy_settings...");
      const { error: rpcError } = await client.rpc("exec_sql", {
        sql: `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude DECIMAL(10, 8) NOT NULL DEFAULT 0,
  longitude DECIMAL(11, 8) NOT NULL DEFAULT 0,
  delivery_radius_km DECIMAL(8, 2) NOT NULL DEFAULT 5.0,
  max_requests_per_ip_per_day INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
      });

      if (rpcError) {
        addLog("RPC недоступен, пробую через REST...");
        const { error: tableError } = await client
          .from(TABLE_NAME)
          .select("id")
          .limit(1);

        if (tableError && tableError.code === "42P01") {
          throw new Error(
            "Таблица не существует и не удалось создать её автоматически.\n\nВыполни в SQL Editor Supabase:\n\nCREATE TABLE pharmacy_settings (\n  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n  latitude DECIMAL(10,8) NOT NULL DEFAULT 0,\n  longitude DECIMAL(11,8) NOT NULL DEFAULT 0,\n  delivery_radius_km DECIMAL(8,2) NOT NULL DEFAULT 5.0,\n  max_requests_per_ip_per_day INTEGER NOT NULL DEFAULT 100,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);"
          );
        }
        addLog("✓ Таблица уже существует или создана");
      } else {
        addLog("✓ Таблица создана");
      }

      addLog("Проверяю начальную запись...");
      const { data: existing } = await client.from(TABLE_NAME).select("*").limit(1);
      if (!existing || existing.length === 0) {
        addLog("Создаю начальную запись с настройками по умолчанию...");
        const { error: insertErr } = await client.from(TABLE_NAME).insert({
          latitude: 0,
          longitude: 0,
          delivery_radius_km: 5.0,
          max_requests_per_ip_per_day: 100,
        });
        if (insertErr) {
          addLog(`Предупреждение: не удалось создать начальную запись: ${insertErr.message}`);
        } else {
          addLog("✓ Начальные настройки сохранены");
        }
      } else {
        addLog("✓ Настройки уже существуют");
      }

      addLog("Сохраняю конфигурацию...");
      storeConfig(form);
      addLog("✓ Готово! Перехожу в панель управления...");

      setStep("done");
      setTimeout(onComplete, 1200);
    } catch (err: unknown) {
      setStep("credentials");
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Неизвестная ошибка");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">SayPharma Admin</h1>
          <p className="text-slate-400 mt-1 text-sm">Первоначальная настройка Supabase</p>
        </div>

        {step === "credentials" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">SUPABASE_URL</label>
              <input
                type="url"
                placeholder="https://xxxx.supabase.co"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">SUPABASE_ANON_KEY</label>
              <input
                type="password"
                placeholder="eyJ..."
                value={form.anonKey}
                onChange={(e) => setForm({ ...form, anonKey: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">SUPABASE_SERVICE_ROLE_KEY</label>
              <input
                type="password"
                placeholder="eyJ..."
                value={form.serviceRoleKey}
                onChange={(e) => setForm({ ...form, serviceRoleKey: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm font-mono"
              />
              <p className="text-xs text-slate-500 mt-1.5">Нужен для создания таблиц. Хранится только в вашем браузере.</p>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-800/50 rounded-lg p-3">
                <p className="text-red-400 text-sm whitespace-pre-line">{error}</p>
              </div>
            )}

            <button
              onClick={handleConnect}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Подключить и настроить
            </button>

            <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-slate-400 font-medium">Где взять ключи?</p>
              <p className="text-xs text-slate-500">Supabase Dashboard → Project Settings → API</p>
            </div>
          </div>
        )}

        {(step === "testing" || step === "done") && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="space-y-2">
              {log.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 text-sm font-mono">→</span>
                  <span className="text-slate-300 text-sm">{line}</span>
                </div>
              ))}
              {step === "testing" && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-400 text-sm">Выполняется...</span>
                </div>
              )}
              {step === "done" && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-emerald-400 text-lg">✓</span>
                  <span className="text-emerald-400 text-sm font-medium">Настройка завершена!</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
