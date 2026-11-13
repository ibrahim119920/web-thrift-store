import { CircleAlert, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "../../components/product/ProductCard";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { useCart } from "../../context/CartContext";
import { favoritesService } from "../../services";
import type { Product } from "../../types";

export function FavoritesPage() {
  const { add } = useCart();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await favoritesService.list();
      setProducts(response.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const removeFavorite = async (product: Product) => {
    setUpdatingIds((current) => [...current, product._id]);
    try {
      await favoritesService.remove(product._id);
      setProducts((current) => current.filter((item) => item._id !== product._id));
      showToast(`${product.name} dihapus dari favorit.`, "success");
    } catch {
      showToast("Favorit belum dapat diperbarui.", "error");
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== product._id));
    }
  };

  const addAllToCart = () => {
    const availableProducts = products.filter((product) => product.status === "available");
    availableProducts.forEach((product) => add(product._id));
    showToast(`${availableProducts.length} barang tersedia ditambahkan ke keranjang.`, "success");
  };

  const availableCount = products.filter((product) => product.status === "available").length;

  return (
    <section className="container-main py-12 tablet:py-16">
      <div className="flex flex-col gap-5 border-b border-[#e8e9e5] pb-8 tablet:flex-row tablet:items-end tablet:justify-between">
        <div>
          <nav className="mb-5 text-xs text-muted">
            <Link to="/" className="hover:text-ink">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-ink">Favorit</span>
          </nav>
          <h1 className="display-title text-5xl leading-none tablet:text-6xl">
            Favorit <span className="font-display font-normal italic text-pink">Saya</span>
          </h1>
          {!loading && !error && (
            <p className="mt-4 text-sm text-muted">{products.length} barang disimpan</p>
          )}
        </div>
        {!loading && products.length > 0 && (
          <Button onClick={addAllToCart} disabled={availableCount === 0} className="rounded-[10px]">
            <ShoppingBag size={17} />
            Masukkan semua ke keranjang
          </Button>
        )}
      </div>

      <div className="mt-7 flex items-center gap-3 rounded-lg bg-lime px-4 py-3.5 text-sm">
        <CircleAlert size={18} className="shrink-0" />
        <p className="font-semibold">Stok semua barang cuma 1, segera amankan sebelum habis.</p>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 desktop:grid-cols-3 desktop:gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="aspect-[4/5] w-full" />
                <Skeleton className="mx-4 mt-4 h-3 w-2/3" />
                <Skeleton className="mx-4 mt-2 h-5 w-3/4" />
                <Skeleton className="mx-4 mb-4 mt-3 h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={() => void load()} />
        ) : products.length === 0 ? (
          <EmptyState
            title="Belum ada barang favorit"
            description="Simpan barang yang kamu suka agar mudah ditemukan kembali."
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
          <div className="grid grid-cols-2 gap-4 tablet:grid-cols-2 tablet:gap-5 desktop:grid-cols-3 desktop:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                favorite
                favoriteLoading={updatingIds.includes(product._id)}
                onFavoriteToggle={() => void removeFavorite(product)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
