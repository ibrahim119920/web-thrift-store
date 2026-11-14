import { ArrowLeft, ArrowRight, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadMore } from "../../components/ui/LoadMore";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { formatRupiah } from "../../lib/format";
import { orderStatusClass, orderStatusLabel, orderStatusOptions } from "../../lib/order";
import { ordersService } from "../../services";
import type { Order, OrderStatus } from "../../types";

type Filter = "all" | OrderStatus;

const PAGE_SIZE = 10;

export function OrdersPage() {
  const { id } = useParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const cancelOrder = async (orderId: string) => {
    if (!window.confirm("Batalkan pesanan ini?")) return;
    setCancellingId(orderId);
    try {
      const response = await ordersService.cancel(orderId);
      setOrders((current) =>
        current.map((order) => (order._id === orderId ? response.data : order)),
      );
      showToast("Pesanan dibatalkan.", "success");
    } catch {
      showToast("Pesanan belum dapat dibatalkan.", "error");
    } finally {
      setCancellingId(null);
    }
  };

  const fetchPage = async (nextPage: number) => {
    const response = await ordersService.list({
      status: filter === "all" ? undefined : filter,
      page: nextPage,
      limit: PAGE_SIZE,
    });
    setTotalPages(response.pagination?.totalPages ?? 1);
    setTotalOrders(response.pagination?.totalData ?? response.data.length);
    return response.data;
  };

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      if (id) {
        const response = await ordersService.get(id);
        setOrders(response.data ? [response.data] : []);
        setTotalOrders(response.data ? 1 : 0);
      } else {
        setOrders(await fetchPage(1));
        setPage(1);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await fetchPage(next);
      setOrders((current) => [...current, ...data]);
      setPage(next);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filter]);

  const visibleOrders = orders;

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
        {!id && <p className="text-xs font-bold">{totalOrders} TOTAL PESANAN</p>}
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
                    <div className="mt-4 flex flex-col gap-3">
                      <Link
                        to={`/orders/${order._id}/pay`}
                        className="inline-flex items-center gap-2 text-xs font-bold"
                      >
                        Lanjut bayar <ArrowRight size={14} />
                      </Link>
                      <button
                        type="button"
                        disabled={cancellingId === order._id}
                        onClick={() => void cancelOrder(order._id)}
                        className="inline-flex w-fit items-center gap-2 text-xs font-bold text-red-600 disabled:opacity-50"
                      >
                        {cancellingId === order._id ? "Membatalkan..." : "Batalkan pesanan"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
          {id && visibleOrders[0] && <OrderDetail order={visibleOrders[0]} />}
          {!id && (
            <LoadMore hasMore={page < totalPages} loading={loadingMore} onClick={() => void loadMore()} />
          )}
        </div>
      )}
    </main>
  );
}

const timelineSteps: OrderStatus[] = ["waiting_payment", "paid", "processing", "shipped", "completed"];

function OrderDetail({ order }: { order: Order }) {
  const address = typeof order.shippingAddressId === "object" ? order.shippingAddressId : null;
  const currentStep = timelineSteps.indexOf(order.status);

  return (
    <section className="grid gap-5 tablet:grid-cols-2">
      <div className="border border-[#deded9] bg-white p-5">
        <h2 className="font-extrabold">Alamat pengiriman</h2>
        {address ? (
          <div className="mt-3 space-y-1 text-sm leading-6">
            <p className="font-bold">
              {address.recipientName} · {address.phone}
            </p>
            <p className="text-muted">
              {address.address}, {address.district}, {address.city}, {address.province}{" "}
              {address.postalCode}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Alamat tidak tersedia.</p>
        )}
        <div className="mt-5 border-t border-[#e8e8e3] pt-4 text-sm">
          <p className="text-xs font-bold text-muted">NOMOR RESI</p>
          <p className="mt-1 font-bold">
            {order.shipping.trackingNumber || "Belum tersedia"}
          </p>
        </div>
      </div>

      <div className="border border-[#deded9] bg-white p-5">
        <h2 className="font-extrabold">Rincian pembayaran</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {order.items.map((item) => (
            <div key={item.productId} className="flex justify-between gap-4">
              <dt className="text-muted">
                {item.name} × {item.qty}
              </dt>
              <dd className="font-semibold">{formatRupiah(item.price * item.qty)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-[#e8e8e3] pt-2">
            <dt className="text-muted">Ongkos kirim</dt>
            <dd className="font-semibold">{formatRupiah(order.shippingCost)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-bold">Total</dt>
            <dd className="font-black">{formatRupiah(order.total)}</dd>
          </div>
        </dl>
      </div>

      {order.status === "cancelled" ? (
        <div className="border border-[#deded9] bg-white p-5 tablet:col-span-2">
          <p className="font-extrabold">Pesanan dibatalkan</p>
        </div>
      ) : (
        <div className="border border-[#deded9] bg-white p-5 tablet:col-span-2">
          <h2 className="font-extrabold">Status pesanan</h2>
          <ol className="mt-4 grid gap-3 tablet:grid-cols-5">
            {timelineSteps.map((step, index) => {
              const reached = index <= currentStep;
              return (
                <li
                  key={step}
                  className={`border-b-4 pb-3 text-xs font-bold ${
                    reached ? "border-ink text-ink" : "border-[#e0e0da] text-muted"
                  }`}
                >
                  {orderStatusLabel(step)}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
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
