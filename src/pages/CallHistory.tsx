import { useState, useEffect, useCallback } from "react";
  import { getCallTranscripts, type CallTranscript } from "@/lib/api";

  type Status = "loading" | "idle" | "error";

  function fmtDuration(sec: number | null): string {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    completed: { label: "Завершён",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
    missed:    { label: "Пропущен", cls: "bg-amber-500/15   text-amber-400   border-amber-500/20"   },
    failed:    { label: "Ошибка",   cls: "bg-red-500/15     text-red-400     border-red-500/20"     },
  };

  function CallCard({ call }: { call: CallTranscript }) {
    const [open, setOpen] = useState(false);
    const cfg = STATUS_CFG[call.status] ?? STATUS_CFG.completed;

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full text-left px-4 py-4 flex items-start gap-3 active:opacity-70 transition-opacity"
        >
          {/* Icon */}
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm">{call.phone}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.cls}`}>
                {cfg.label}
              </span>
            </div>
            {call.client_name && (
              <p className="text-slate-400 text-xs mt-0.5">{call.client_name}</p>
            )}
            {call.summary && (
              <p className="text-slate-500 text-xs mt-1 line-clamp-1">{call.summary}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-slate-600 text-xs">{fmtDate(call.called_at)}</span>
              {call.duration_sec != null && (
                <span className="text-slate-600 text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                  </svg>
                  {fmtDuration(call.duration_sec)}
                </span>
              )}
              {call.agent_name && (
                <span className="text-slate-600 text-xs">{call.agent_name}</span>
              )}
            </div>
          </div>

          {/* Chevron */}
          <svg className={`w-4 h-4 text-slate-600 flex-shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="border-t border-slate-800 px-4 py-4 space-y-3">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-2">
              {call.agent_name && (
                <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                  <p className="text-slate-500 text-[10px] font-medium mb-0.5">Агент</p>
                  <p className="text-slate-300 text-xs">{call.agent_name}</p>
                </div>
              )}
              {call.order_id && (
                <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                  <p className="text-slate-500 text-[10px] font-medium mb-0.5">Заказ</p>
                  <p className="text-slate-300 text-xs font-mono">{call.order_id.slice(0, 8)}…</p>
                </div>
              )}
            </div>

            {/* Transcript */}
            {call.transcript ? (
              <div>
                <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wide mb-2">Стенограмма</p>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 max-h-64 overflow-y-auto">
                  <pre className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                    {call.transcript}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-slate-600 text-xs italic">Стенограмма недоступна</p>
            )}
          </div>
        )}
      </div>
    );
  }

  export default function CallHistory() {
    const [records, setRecords]   = useState<CallTranscript[]>([]);
    const [status, setStatus]     = useState<Status>("loading");
    const [error, setError]       = useState<string | null>(null);

    const [phone,     setPhone]     = useState("");
    const [clientName, setClientName] = useState("");
    const [dateFrom,  setDateFrom]  = useState("");
    const [dateTo,    setDateTo]    = useState("");

    const load = useCallback(async () => {
      setStatus("loading");
      setError(null);
      try {
        const data = await getCallTranscripts({
          phone:       phone.trim()       || undefined,
          client_name: clientName.trim()  || undefined,
          date_from:   dateFrom           || undefined,
          date_to:     dateTo             || undefined,
        });
        setRecords(data);
        setStatus("idle");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
        setStatus("error");
      }
    }, [phone, clientName, dateFrom, dateTo]);

    // Auto-load on mount
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleReset = () => {
      setPhone(""); setClientName(""); setDateFrom(""); setDateTo("");
    };

    const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 text-sm";

    const hasFilters = phone || clientName || dateFrom || dateTo;

    return (
      <div className="bg-slate-950 min-h-screen">
        {/* Header */}
        <header className="pt-safe border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-sm">История разговоров</span>
            {status === "idle" && (
              <span className="ml-auto text-xs text-slate-500">{records.length} зап.</span>
            )}
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-24">
          {/* Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Телефон</label>
                <input type="tel" placeholder="+380..." value={phone}
                  onChange={e => setPhone(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Имя клиента</label>
                <input type="text" placeholder="Иванов..." value={clientName}
                  onChange={e => setClientName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Дата с</label>
                <input type="date" value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Дата по</label>
                <input type="date" value={dateTo}
                  onChange={e => setDateTo(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2">
              {hasFilters && (
                <button onClick={handleReset}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-slate-600 transition-colors">
                  Сбросить
                </button>
              )}
              <button onClick={load} disabled={status === "loading"}
                className={`py-2 rounded-xl text-sm font-semibold transition-colors ${hasFilters ? "flex-1" : "w-full"} ${
                  status === "loading"
                    ? "bg-blue-600/50 text-white/50 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}>
                {status === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Поиск...
                  </span>
                ) : "Найти"}
              </button>
            </div>
          </div>

          {/* Error */}
          {status === "error" && (
            <div className="bg-red-950/50 border border-red-800/50 rounded-xl p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Empty */}
          {status === "idle" && records.length === 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Разговоров не найдено</p>
              {hasFilters && <p className="text-slate-600 text-xs mt-1">Попробуйте изменить фильтры</p>}
            </div>
          )}

          {/* List */}
          {status === "idle" && records.length > 0 && (
            <div className="space-y-3">
              {records.map(r => <CallCard key={r.id} call={r} />)}
            </div>
          )}
        </main>
      </div>
    );
  }
  