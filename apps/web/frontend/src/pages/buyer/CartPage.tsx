import { Check, MapPin, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { useCart } from "../../context/CartContext";
import { STORE_LOCATION } from "../../lib/constants";
import { formatRupiah } from "../../lib/format";
import { getProduct } from "../../services/products";
import type { Product } from "../../types";

export function CartPage() {
  const { productIds, remove, selectedIds, toggleSelection } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const responses = await Promise.all(productIds.map((id) => getProduct(id)));
      setProducts(
        productIds
          .map((id) => responses.find((response) => response.data?._id === id)?.data)
          .filter((product): product is Product => Boolean(product)),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [productIds.join(",")]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.includes(product._id)),
    [products, selectedIds],
  );
  const subtotal = useMemo(
    () => selectedProducts.reduce((total, product) => total + product.price, 0),
    [selectedProducts],
  );
  const allAvailable = selectedProducts.every((product) => product.status === "available");

  const removeProduct = (product: Product) => {
    remove(product._id);
    setProducts((current) => current.filter((item) => item._id !== product._id));
    showToast(`${product.name} dihapus dari keranjang.`, "success");
  };

  return (
    <section className="container-main py-12 tablet:py-16">
      <nav className="mb-5 text-xs text-muted">
        <Link to="/" className="hover:text-ink">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">Keranjang</span>
      </nav>
      <h1 className="display-title text-5xl leading-none tablet:text-6xl">Keranjang</h1>
      <p className="mt-4 text-sm text-muted">Setiap pakaian adalah barang unik dengan satu stok.</p>

      <div className="mt-10 grid items-start gap-8 desktop:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-5 flex items-center gap-3 border border-[#e8e9e5] bg-canvas px-5 py-4">
            <MapPin size={19} className="shrink-0 text-pink" />
            <div>
              <p className="text-xs text-muted">Dikirim dari</p>
              <p className="mt-1 text-sm font-bold">{STORE_LOCATION}</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="grid h-[190px] grid-cols-[24px_90px_1fr] gap-3 border border-[#e8e9e5] p-3 tablet:h-[230px] tablet:grid-cols-[28px_150px_1fr] tablet:gap-5 tablet:p-5"
                >
                  <Skeleton className="mt-1 size-5 tablet:self-center" />
                  <Skeleton className="h-full w-full" />
                  <div className="space-y-3 py-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState onRetry={() => void load()} />
          ) : products.length === 0 ? (
            <EmptyState
              title="Keranjangmu masih kosong"
              description="Temukan pakaian preloved yang siap melanjutkan cerita bersamamu."
              action={
                <Link
                  to="/shop"
                  className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-ink px-5 text-sm font-bold text-white transition hover:bg-pink"
                >
                  Lihat katalog
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <article
                  key={product._id}
                  className="grid h-[190px] grid-cols-[24px_90px_minmax(0,1fr)] items-stretch gap-3 border border-[#e8e9e5] bg-white p-3 tablet:h-[230px] tablet:grid-cols-[28px_150px_minmax(0,1fr)] tablet:gap-5 tablet:p-5"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selectedIds.includes(product._id)}
                    onClick={() => toggleSelection(product._id)}
                    className={`mt-1 grid size-5 place-items-center self-start rounded-[3px] border transition tablet:mt-0 tablet:self-center ${
                      selectedIds.includes(product._id)
                        ? "border-ink bg-ink text-white"
                        : "border-[#9a9a94] bg-white"
                    }`}
                    aria-label={`${selectedIds.includes(product._id) ? "Batalkan pilihan" : "Pilih"} ${product.name}`}
                  >
                    {selectedIds.includes(product._id) && <Check size={14} strokeWidth={3} />}
                  </button>
                  <Link
                    to={`/products/${product._id}`}
                    className="h-full overflow-hidden bg-[#f1f1ed]"
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                          {product.brand}
                        </p>
                        <Link
                          to={`/products/${product._id}`}
                          className="mt-1 block font-extrabold hover:text-pink tablet:text-lg"
                        >
                          {product.name}
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProduct(product)}
                        className="grid size-9 shrink-0 place-items-center rounded-full border border-[#deded9] transition hover:border-pink hover:text-pink"
                        aria-label={`Hapus ${product.name} dari keranjang`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <p className="mt-3 truncate text-xs font-semibold tablet:text-sm">
                      LD {product.size.chest} cm · PB {product.size.length} cm
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      Grade {product.condition.grade}
                      {" · "}
                      {product.condition.minusTags.length
                        ? `Defect: ${product.condition.minusTags.join(", ")}`
                        : "Tanpa defect tercatat"}
                    </p>
                    {product.status !== "available" && (
                      <div className="mt-3">
                        <Badge status={product.status} />
                      </div>
                    )}
                    <strong className="mt-auto pt-4 text-base">
                      {formatRupiah(product.price)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="border border-[#e8e9e5] bg-white p-6 shadow-[0_10px_30px_rgba(25,26,24,0.06)] desktop:sticky desktop:top-28">
          <div className="flex items-center gap-3">
            <ShoppingBag size={20} />
            <h2 className="text-lg font-extrabold">Ringkasan Pesanan</h2>
          </div>
          <dl className="mt-6 space-y-5 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt>Subtotal ({selectedProducts.length} barang)</dt>
              <dd className="font-bold">{formatRupiah(subtotal)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-[#e8e9e5] pb-5">
              <dt>
                <span className="block">Pengiriman</span>
                <span className="mt-1 block text-xs text-muted">Dari {STORE_LOCATION}</span>
              </dt>
              <dd className="text-right text-xs text-muted">Dihitung saat checkout</dd>
            </div>
            <div className="flex items-center justify-between gap-4 text-base">
              <dt className="font-extrabold">Total</dt>
              <dd className="font-extrabold">{formatRupiah(subtotal)}</dd>
            </div>
          </dl>
          {!allAvailable && selectedProducts.length > 0 && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">
              Hapus barang yang sudah tidak tersedia sebelum melanjutkan.
            </p>
          )}
          <Button
            className="mt-6 w-full rounded-[10px]"
            disabled={loading || selectedProducts.length === 0 || !allAvailable}
            onClick={() => navigate("/checkout")}
          >
            Checkout ({selectedProducts.length})
          </Button>
        </aside>
      </div>
    </section>
  );
}
