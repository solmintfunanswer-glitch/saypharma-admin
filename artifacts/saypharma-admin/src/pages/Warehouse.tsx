import { useState, useEffect, useCallback, useRef } from "react";
  import {
    getProducts, getStockMovements, createStockMovement, deleteStockMovement,
    getStockBalance, getOrders, CANCEL_RETURN_PREFIX,
    type Product, type StockMovement, type MovementType, type NewStockMovement,
    type StockBalance,
  } from "@/lib/api";
  import { useCurrency } from "@/lib/CurrencyContext";

  type ViewTab = "all" | MovementType | "balance" | "return";

  const TYPE_LABELS: Record<MovementType, string> = { in: "Приход", out: "Расход", write_off: "Списание" };
  const TYPE_COLORS: Record<MovementType, string> = {
    in:        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    out:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
    write_off: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const EMPTY_FORM = {
    product_id: "",
    type: "in" as MovementType,
    quantity: "1",
    purchase_price: "" as string,
    purchase_price_vat: "" as string,
    expiry_date: "" as string,
    operation_date: new Date().toISOString().slice(0, 16),
    notes: "" as string,
  };

  function fmt(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function fmtPrice(v: number | null, sym: string) {
    if (v == null) return "—";
    return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + sym;
  }

  /** Auto-creates stock-return movements for cancelled orders that don't have them yet */
  async function syncCancelledReturns(prods: Product[]): Promise<void> {
    const [cancelledOrders, inMovements] = await Promise.all([
      getOrders("cancelled"),
      getStockMovements("in"),
    ]);

    const alreadyReturned = new Set<string>();
    for (const m of inMovements) {
      if (m.notes?.startsWith(CANCEL_RETURN_PREFIX)) {
        alreadyReturned.add(m.notes.slice(CANCEL_RETURN_PREFIX.length, CANCEL_RETURN_PREFIX.length + 8));
      }
    }

    for (const order of cancelledOrders) {
      const shortId = order.id.slice(0, 8);
      if (alreadyReturned.has(shortId)) continue;

      const items = Array.isArray(order.items) ? order.items : [];
      const clientName = order.full_name
        || [order.first_name, order.last_name].filter(Boolean).join(" ")
        || order.phone;

      for (const item of items) {
        if (!item.quantity || item.quantity <= 0) continue;
        let productId = item.product_id;
        if (!productId && item.name) {
          productId = prods.find(
            p => p.name.toLowerCase().trim() === (item.name ?? "").toLowerCase().trim()
          )?.id;
        }
        if (!productId) continue;
        try {
          await createStockMovement({
            product_id: productId,
            type: "in",
            quantity: item.quantity,
            notes: `${CANCEL_RETURN_PREFIX}${shortId} — ${clientName}`,
            operation_date: order.updated_at,
          });
        } catch { /* skip items that can't be returned */ }
      }
    }
  }

  export default function Warehouse() {
    const [products, setProducts]   = useState<Product[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [balance, setBalance]     = useState<StockBalance[]>([]);
    const [loading, setLoading]     = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [tab, setTab]             = useState<ViewTab>("all");
    const [formOpen, setFormOpen]   = useState(false);
    const [form, setForm]           = useState(EMPTY_FORM);
    const [saving, setSaving]       = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [productPickerOpen, setProductPickerOpen] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    const { sym } = useCurrency();

    const loadMovements = useCallback(async (t: ViewTab) => {
      setLoading(true); setLoadError(null);
      try {
        if (t === "balance") {
          const [prods, bal] = await Promise.all([getProducts(), getStockBalance()]);
          setProducts(prods); setBalance(bal);
        } else if (t === "return") {
          // Load products first, then sync all cancelled orders, then fetch movements
          const prods = await getProducts();
          setProducts(prods);
          await syncCancelledReturns(prods);
          const movs = await getStockMovements("in");
          setMovements(movs.filter(m => m.notes?.startsWith(CANCEL_RETURN_PREFIX)));
        } else {
          const [prods, movs] = await Promise.all([
            getProducts(),
            getStockMovements(t === "all" ? undefined : t),
          ]);
          setProducts(prods); setMovements(movs);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { loadMovements("all"); }, [loadMovements]);

    const switchTab = (t: ViewTab) => { setTab(t); loadMovements(t); };

    const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) =>
      setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const qty = parseInt(form.quantity, 10);
      if (!form.product_id) { setSaveError("Выберите товар"); return; }
      if (isNaN(qty) || qty <= 0) { setSaveError("Количество должно быть больше 0"); return; }
      setSaving(true); setSaveError(null);
      try {
        const payload: NewStockMovement = {
          product_id:         form.product_id,
          type:               form.type,
          quantity:           qty,
          purchase_price:     form.purchase_price     ? Number(form.purchase_price)     : null,
          purchase_price_vat: form.purchase_price_vat ? Number(form.purchase_price_vat) : null,
          expiry_date:        form.expiry_date        || null,
          operation_date:     form.operation_date,
          notes:              form.notes              || null,
        };
        await createStockMovement(payload);
        setForm({ ...EMPTY_FORM, operation_date: new Date().toISOString().slice(0, 16) });
        setFormOpen(false);
        await loadMovements(tab);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Ошибка сохранения");
      } finally {
        setSaving(false);
      }
    };

    const handleDelete = async (id: string) => {
      if (!confirm("Удалить запись о движении?")) return;
      setDeletingId(id);
      try {
        await deleteStockMovement(id);
        setMovements(ms => ms.filter(m => m.id !== id));
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка удаления");
      } finally {
        setDeletingId(null);
      }
    };

    const inp = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 text-sm";
    const lbl = "block text-xs font-medium text-slate-400 mb-1";

    const counterText = tab === "balance"
      ? `${balance.length} позиций`
      : tab === "return"
        ? `${movements.length} возвратов`
        : `${movements.length} записей`;

    return (
      <div className="bg-slate-950 min-h-screen">
        <header className="pt-safe border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-xs font-bold">S</span>
            </div>
            <span className="text-white font-semibold text-sm">SayPharma Admin</span>
            <span className="ml-auto text-xs text-slate-500">{counterText}</span>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

          {tab !== "balance" && tab !== "return" && (
            <button onClick={() => { setFormOpen(o => !o); setSaveError(null); }}
              className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl px-5 py-4 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-white font-semibold text-sm">Добавить операцию</span>
              </div>
              <svg className={`w-4 h-4 text-slate-500 transition-transform ${formOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {formOpen && tab !== "balance" && tab !== "return" && (
            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className={lbl}>Тип операции</label>
                <div className="flex gap-2">
                  {(["in", "out", "write_off"] as MovementType[]).map(t => (
                    <button key={t} type="button" onClick={() => set("type", t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                        form.type === t ? TYPE_COLORS[t] : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={lbl}>Препарат <span className="text-red-400">*</span></label>
                <div className="relative">
                  <button type="button"
                    onClick={() => { setProductPickerOpen(o => !o); setProductSearch(""); setTimeout(() => searchRef.current?.focus(), 50); }}
                    className={`${inp} text-left flex items-center justify-between`}>
                    <span className={form.product_id ? "text-white" : "text-slate-600"}>
                      {form.product_id
                        ? (() => { const p = products.find(x => x.id === form.product_id); return p ? `${p.name}${p.form ? ` (${p.form})` : ""}` : "—"; })()
                        : "— выберите товар —"}
                    </span>
                    <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {productPickerOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-slate-700">
                        <div className="relative">
                          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input ref={searchRef} type="text" placeholder="Поиск по названию..."
                            value={productSearch} onChange={e => setProductSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 text-sm" />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {(() => {
                          const q = productSearch.toLowerCase();
                          const filtered = products.filter(p =>
                            p.name.toLowerCase().includes(q) ||
                            (p.form ?? "").toLowerCase().includes(q) ||
                            (p.active_substance ?? "").toLowerCase().includes(q)
                          );
                          if (filtered.length === 0) return <div className="px-4 py-6 text-center text-slate-500 text-sm">Ничего не найдено</div>;
                          return filtered.map(p => (
                            <button key={p.id} type="button"
                              onClick={() => { set("product_id", p.id); setProductPickerOpen(false); setProductSearch(""); }}
                              className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-slate-700/50 last:border-0 ${
                                form.product_id === p.id ? "bg-emerald-500/15 text-emerald-300" : "text-slate-300 hover:bg-slate-700/60"
                              }`}>
                              <span className="font-medium">{p.name}</span>
                              {p.form && <span className="text-slate-500 ml-1">({p.form})</span>}
                              {p.active_substance && <span className="block text-[11px] text-slate-600 mt-0.5">{p.active_substance}</span>}
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Количество <span className="text-red-400">*</span></label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" className={inp}
                    value={form.quantity} onChange={e => set("quantity", e.target.value.replace(/[^0-9]/g, ""))} />
                </div>
                <div>
                  <label className={lbl}>Дата операции</label>
                  <input type="datetime-local" className={`${inp} [color-scheme:dark]`}
                    value={form.operation_date} onChange={e => set("operation_date", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Цена без НДС ({sym})</label>
                  <input type="number" min={0} step="0.01" placeholder="0.00" className={inp}
                    value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Цена с НДС ({sym})</label>
                  <input type="number" min={0} step="0.01" placeholder="0.00" className={inp}
                    value={form.purchase_price_vat} onChange={e => set("purchase_price_vat", e.target.value)} />
                </div>
              </div>

              <div>
                <label className={lbl}>Срок годности</label>
                <input type="date" className={`${inp} [color-scheme:dark]`}
                  value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)} />
              </div>

              <div>
                <label className={lbl}>Примечание</label>
                <textarea className={`${inp} resize-none`} rows={2} placeholder="Поставщик, накладная №..."
                  value={form.notes} onChange={e => set("notes", e.target.value)} />
              </div>

              {saveError && (
                <div className="bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
                  <p className="text-red-400 text-sm">{saveError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button"
                  onClick={() => { setFormOpen(false); setForm({ ...EMPTY_FORM, operation_date: new Date().toISOString().slice(0, 16) }); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-slate-600 transition-colors">
                  Отмена
                </button>
                <button type="submit" disabled={saving}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    saving ? "bg-emerald-600/50 text-white/50 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-400 text-white"
                  }`}>
                  {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          )}

          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {([
              { id: "all",       label: "Все"       },
              { id: "in",        label: "Приход"    },
              { id: "out",       label: "Расход"    },
              { id: "write_off", label: "Списание"  },
              { id: "return",    label: "По отмене" },
              { id: "balance",   label: "Остатки"   },
            ] as { id: ViewTab; label: string }[]).map(({ id, label }) => (
              <button key={id} onClick={() => switchTab(id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                  tab === id
                    ? id === "balance" ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                    : id === "return"  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : id === "all"     ? "bg-slate-700 border-slate-600 text-white"
                    : TYPE_COLORS[id as MovementType]
                    : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Movements list */}
          {tab !== "balance" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">
                  {tab === "return" ? "Возвраты по отменённым заказам" : "История движений"}
                </h2>
                <button onClick={() => loadMovements(tab)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  {tab === "return" && <p className="text-slate-600 text-xs">Синхронизация возвратов...</p>}
                </div>
              )}
              {!loading && loadError && (
                <div className="px-5 py-8 text-center">
                  <p className="text-red-400 text-sm mb-3">{loadError}</p>
                  <button onClick={() => loadMovements(tab)} className="text-xs text-slate-400 hover:text-white transition-colors">Повторить</button>
                </div>
              )}
              {!loading && !loadError && movements.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <p className="text-slate-500 text-sm">
                    {tab === "return" ? "Отменённых заказов с товарами нет" : "Операций пока нет"}
                  </p>
                </div>
              )}
              {!loading && !loadError && movements.length > 0 && (
                <div className="divide-y divide-slate-800/60">
                  {movements.map(m => (
                    <div key={m.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {tab === "return" ? (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                                Возврат по отмене
                              </span>
                            ) : (
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[m.type]}`}>
                                {TYPE_LABELS[m.type]}
                              </span>
                            )}
                            <span className="text-white text-sm font-medium">
                              {m.products?.name ?? m.product_id}
                              {m.products?.form ? ` · ${m.products.form}` : ""}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-600 text-xs">Кол-во:</span>
                              <span className="text-slate-200 text-xs font-medium">{m.quantity} шт.</span>
                            </div>
                            {m.expiry_date && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-600 text-xs">Годен до:</span>
                                <span className="text-slate-200 text-xs font-medium">{fmtDate(m.expiry_date)}</span>
                              </div>
                            )}
                            {m.purchase_price != null && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-600 text-xs">Без НДС:</span>
                                <span className="text-slate-200 text-xs font-medium">{fmtPrice(m.purchase_price, sym)}</span>
                              </div>
                            )}
                            {m.purchase_price_vat != null && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-600 text-xs">С НДС:</span>
                                <span className="text-slate-200 text-xs font-medium">{fmtPrice(m.purchase_price_vat, sym)}</span>
                              </div>
                            )}
                          </div>
                          {m.notes && (
                            <p className="mt-1.5 text-slate-500 text-xs">
                              {tab === "return"
                                ? m.notes.replace(CANCEL_RETURN_PREFIX, "Заказ: ")
                                : m.notes}
                            </p>
                          )}
                          <p className="mt-1 text-slate-700 text-[10px]">{fmt(m.operation_date)}</p>
                        </div>
                        {tab !== "return" && (
                          <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-950/30 transition-colors">
                            {deletingId === m.id
                              ? <div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
                              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Balance tab */}
          {tab === "balance" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">Текущие остатки</h2>
                <button onClick={() => loadMovements("balance")} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              {loading && <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>}
              {!loading && loadError && (
                <div className="px-5 py-8 text-center">
                  <p className="text-red-400 text-sm mb-3">{loadError}</p>
                  <button onClick={() => loadMovements("balance")} className="text-xs text-slate-400 hover:text-white">Повторить</button>
                </div>
              )}
              {!loading && !loadError && balance.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-slate-500 text-sm">Нет данных об остатках</p>
                </div>
              )}
              {!loading && !loadError && balance.length > 0 && (
                <div className="divide-y divide-slate-800/60">
                  {balance.map(b => (
                    <div key={b.product_id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                              b.current_quantity > 0
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}>
                              {b.current_quantity} шт.
                            </span>
                            <span className="text-white text-sm font-semibold">{b.name}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                            {b.form             && <div className="flex items-center gap-1.5"><span className="text-slate-600 text-xs">Форма:</span><span className="text-slate-200 text-xs">{b.form}</span></div>}
                            {b.active_substance && <div className="flex items-center gap-1.5"><span className="text-slate-600 text-xs">Вещество:</span><span className="text-slate-200 text-xs">{b.active_substance}</span></div>}
                            {b.expiry_date      && <div className="flex items-center gap-1.5"><span className="text-slate-600 text-xs">Годен до:</span><span className="text-slate-200 text-xs">{fmtDate(b.expiry_date)}</span></div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }
  