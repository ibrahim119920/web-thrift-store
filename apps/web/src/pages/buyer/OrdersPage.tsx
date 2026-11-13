import { ArrowLeft, ArrowRight, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatRupiah } from "../../lib/format";
import { orderStatusClass, orderStatusLabel, orderStatusOptions } from "../../lib/order";
import { ordersService } from "../../services";
import type { Order, OrderStatus } from "../../types";

type Filter = "all" | OrderStatus;

export function OrdersPage() {
  const { id } = useParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await ordersService.list();
      setOrders(response.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleOrders = id
    ? orders.filter((order) => order._id === id)
    : filter === "all"
      ? orders
      : orders.filter((order) => order.status === filter);

  return (
    <main className="container-main py-12 tablet:py-16">
      <div className="flex flex-col gap-4 border-b border-[#e5e5df] pb-8 tablet:flex-row tablet:items-end tablet:justify-between">
        <div>
          {id && (
            <Link to="/orders" className="mb-5 inline-flex items-center gap-2 text-xs font-bold">
              <ArrowLeft size={14} /> Kembali ke semua pesanan
            </Link>
          )}
          <h1 className="display-title text-5xl tablet:text-6xl">
            {id ? "Detail pesanan" : "Pesanan saya"}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            Pantau pembayaran, proses, dan pengiriman semua pakaian pilihanmu.
          </p>
        </div>
        {!id && <p className="text-xs font-bold">{orders.length} TOTAL PESANAN</p>}
      </div>

      {!id && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-7 tablet:mx-0 tablet:px-0">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
            Semua
          </FilterButton>
          {orderStatusOptions.map((status) => (
            <FilterButton
              key={status.value}
              active={filter === status.value}
              onClick={() => setFilter(status.value)}
            >
              {status.label}
            </FilterButton>
          ))}
        </div>
      )}
      {id && <div className="h-7" />}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={() => void load()} />
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          title="Belum ada pesanan pada status ini"
          description={
            id ? "Pesanan ini tidak ditemukan." : "Pesanan yang sesuai akan muncul di sini."
          }
          action={
            <Link
              to="/shop"
              className="inline-flex min-h-11 items-center bg-ink px-5 text-sm font-bold text-white"
            >
              Mulai belanja
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => (
            <article key={order._id} className="border border-[#deded9] bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e8e3] bg-canvas px-5 py-4">
                <div>
                  <p className="text-[11px] font-bold text-muted">NOMOR PESANAN</p>
                  <p className="mt-1 text-sm font-extrabold">{order.orderNumber}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-2 text-[11px] font-bold ${orderStatusClass(order.status)}`}
                >
                  {orderStatusLabel(order.status)}
                </span>
              </header>
              <div className="grid gap-5 p-5 tablet:grid-cols-[1fr_auto] tablet:items-center">
                <div>
                  <div className="flex items-start gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lime">
                      <PackageCheck size={20} />
                    </span>
                    <div>
                      <h2 className="font-extrabold">{order.items[0]?.name}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {order.items.length > 1
                          ? `dan ${order.items.length - 1} barang lainnya`
                          : "1 barang"}
                      </p>
                      <p className="mt-3 text-xs text-muted">
                        {order.shipping.courier.toUpperCase()} ·{" "}
                        {order.shipping.service.toUpperCase()}
                        {order.shipping.trackingNumber && ` · ${order.shipping.trackingNumber}`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#e8e8e3] pt-4 tablet:min-w-48 tablet:border-l tablet:border-t-0 tablet:pl-7 tablet:pt-0">
                  <p className="text-xs text-muted">Total belanja</p>
                  <p className="mt-1 text-lg font-black">{formatRupiah(order.total)}</p>
                  {order.status === "waiting_payment" && (
                    <Link
                      to={`/orders/${order._id}/pay`}
                      className="mt-4 inline-flex items-center gap-2 text-xs font-bold"
                    >
                      Lanjut bayar <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold transition ${
        active ? "border-ink bg-ink text-white" : "border-[#d9d9d3] bg-white hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
