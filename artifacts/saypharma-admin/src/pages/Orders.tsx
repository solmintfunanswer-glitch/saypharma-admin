import { useState, useCallback, useEffect } from "react";
import {
  getOrders, updateOrderStatus, updateOrderPayment,
  createStockMovement,
  type Order, type OrderStatus,
} from "@/lib/api";
import { useCurrency } from "@/lib/CurrencyContext";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new:         "Новый",
  accepted:    "Принят",
  prepared:    "Готовится",
  in_delivery: "Доставляется",
  delivered:   "Доставлен",
  cancelled:   "Отменён",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  new:         "bg-blue-500/15 text-blue-400 border-blue-500/30",
  accepted:    "bg-violet-500/15 text-violet-400 border-violet-500/30",
  prepared:    "bg-amber-500/15 text-amber-400 border-amber-500/30",
  in_delivery: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  delivered:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelled:   "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new:         ["accepted", "cancelled"],
  accepted:    ["prepared", "cancelled"],
  prepared:    ["in_delivery", "cancelled"],
  in_delivery: ["delivered", "cancelled"],
  delivered:   [],
  cancelled:   [],
};

type FilterTab = "all" | OrderStatus | "archive";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all",         label: "Все" },
  { id: "new",         label: "Новые" },
  { id: "accepted",    label: "Принятые" },
  { id: "prepared",    label: "Готовятся" },
  { id: "in_delivery", label: "Доставка" },
  { id: "delivered",   label: "Доставлен" },
  { id: "archive",     label: "Архив" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const PAYMENT_METHODS = [
  { value: "cash",   label: "Наличные" },
  { value: "card",   label: "Карта" },
  { value: "online", label: "Онлайн" },
  { value: "kaspi",  label: "Kaspi" },
];

function paymentLabel(v: string | null) {
  if (!v) return null;
  return PAYMENT_METHODS.find(m => m.value === v)?.label ?? v;
}

function OrderCard({ order, sym, isArchive, onStatusChange, onPaymentChange }: {
  order: Order;
  sym: string;
  isArchive: boolean;
  onStatusChange: (id: string, s: OrderStatus) => Promise<void>;
  onPaymentChange: (id: string, p: string) => Promise<void>;
}) {
  const [open, setOpen]             = useState(false);
  const [saving, setSaving]         = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const next = NEXT_STATUSES[order.status];

  const change = async (s: OrderStatus) => {
    setSaving(true);
    await onStatusChange(order.id, s);
    setSaving(false);
    setOpen(false);
  };

  const changePayment = async (p: string) => {
    setSavingPayment(true);
    await onPaymentChange(order.id, p);
    setSavingPayment(false);
  };

  const clientName = order.full_name || [order.first_name, order.last_name].filter(Boolean).join(" ") || "—";
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className={`border rounded-2xl overflow-hidden ${isArchive ? "bg-slate-900/60 border-slate-800/60 opacity-80" : "bg-slate-900 border-slate-800"}`}>
      {/* Header row */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isArchive && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-slate-700/40 text-slate-500 border-slate-700/60 flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
                Архив
              </span>
            )}
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
            <span className="text-slate-500 text-xs">{formatDate(order.created_at)}</span>
          </div>
          <p className={`font-medium text-sm truncate ${isArchive ? "text-slate-400" : "text-white"}`}>{clientName}</p>
          <p className="text-slate-500 text-xs mt-0.5">{order.phone}</p>
          {order.address && (
            <p className="text-slate-600 text-xs mt-0.5 truncate">📍 {order.address}</p>
          )}
        </button>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {order.total_amount != null && (
            <p className={`font-semibold text-sm ${isArchive ? "text-slate-500" : "text-emerald-400"}`}>
              {Number(order.total_amount).toLocaleString("ru-RU")} {sym}
            </p>
          )}
          <button onClick={() => setOpen(o => !o)}
            className="mt-1 w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-400 transition-colors">
            <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-3">
          {/* Items */}
          {items.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Состав заказа</p>
              <div className="space-y-1.5">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-slate-300 text-sm">{it.name || "Товар"}</span>
                    <span className="text-slate-500 text-xs shrink-0">
                      {it.quantity != null ? `× ${it.quantity}` : ""}
                      {it.price != null ? `  ${Number(it.price).toLocaleString("ru-RU")} ${sym}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comment */}
          {order.comment && (
            <div>
              <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider">Комментарий</p>
              <p className="text-slate-300 text-sm">{order.comment}</p>
            </div>
          )}

          {/* Payment method */}
          {order.payment_method && (
            <div>
              <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider">Способ оплаты</p>
              <p className="text-slate-400 text-sm">{paymentLabel(order.payment_method)}</p>
            </div>
          )}

          {/* Status actions — hidden in archive */}
          {!isArchive && next.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Изменить статус</p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => changePayment(m.value)}
                    disabled={savingPayment}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-50 ${
                      order.payment_method === m.value
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 active:opacity-70"
                    }`}
                  >
                    {savingPayment && order.payment_method === m.value ? "…" : m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isArchive && next.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Изменить статус</p>
              <div className="flex flex-wrap gap-2">
                {next.map(s => (
                  <button
                    key={s}
                    onClick={() => change(s)}
                    disabled={saving}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-opacity disabled:opacity-50 ${
                      s === "cancelled"
                        ? "bg-red-500/10 text-red-400 border-red-500/30 active:opacity-70"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 active:opacity-70"
                    }`}
                  >
                    {saving ? "…" : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const { sym } = useCurrency();
  const [tab, setTab]       = useState<FilterTab>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async (filter: FilterTab) => {
    setLoading(true);
    setError(null);
    try {
      // Archive tab fetches cancelled orders
      const statusFilter: OrderStatus | undefined =
        filter === "archive"   ? "cancelled" :
        filter === "all"       ? undefined :
        filter as OrderStatus;
      const data = await getOrders(statusFilter);
      setOrders(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [load, tab]);

  const switchTab = (t: FilterTab) => { setTab(t); load(t); };

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    await updateOrderStatus(id, status);

    // При отмене — возвращаем товары на склад
    if (status === "cancelled") {
      const order = orders.find(o => o.id === id);
      if (order) {
        const items = Array.isArray(order.items) ? order.items : [];
        const now = new Date().toISOString();
        await Promise.allSettled(
          items
            .filter(it => it.product_id && it.quantity && it.quantity > 0)
            .map(it =>
              createStockMovement({
                product_id: it.product_id!,
                type: "return",
                quantity: it.quantity!,
                operation_date: now,
                notes: `Возврат по отмене заказа #${id.slice(0, 8)}`,
              })
            )
        );
      }
    }

    await load(tab);
  };

  const handlePaymentChange = async (id: string, payment_method: string) => {
    await updateOrderPayment(id, payment_method);
    await load(tab);
  };

  const isArchive = tab === "archive";

  return (
    <div className="bg-slate-950 min-h-screen">
      {/* Header */}
      <header className="pt-safe border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-xs font-bold">S</span>
            </div>
            <span className="text-white font-semibold text-sm">
              {isArchive ? "Архив заказов" : "Заказы"}
            </span>
          </div>
          <button
            onClick={() => load(tab)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => switchTab(id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                tab === id
                  ? id === "all"     ? "bg-slate-700 border-slate-600 text-white"
                  : id === "archive" ? "bg-slate-700/60 border-slate-600/60 text-slate-300"
                  : STATUS_COLORS[id as OrderStatus]
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
              }`}>
              {id === "archive" && (
                <svg className="inline w-3 h-3 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              )}
              {label}
            </button>
          ))}
        </div>

        {/* Archive banner */}
        {isArchive && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
            <p className="text-slate-500 text-xs">Отменённые заказы попадают сюда автоматически</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-950/50 border border-red-800/50 rounded-xl p-5 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={() => load(tab)} className="text-xs text-slate-400 hover:text-white transition-colors">Повторить</button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {isArchive ? (
              <>
                <svg className="w-10 h-10 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
                <p className="text-slate-500 text-sm">Архив пуст</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
                <p className="text-slate-500 text-sm">Заказов нет</p>
              </>
            )}
          </div>
        )}

        {!loading && !error && orders.map(o => (
          <OrderCard
            key={o.id}
            order={o}
            sym={sym}
            isArchive={isArchive}
            onStatusChange={handleStatusChange}
            onPaymentChange={handlePaymentChange}
          />
        ))}
      </main>
    </div>
  );
}
