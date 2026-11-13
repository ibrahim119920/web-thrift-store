import { Heart, PackageCheck, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProductCard } from "../../components/product/ProductCard";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { formatRupiah, formatSize } from "../../lib/format";
import { favoritesService } from "../../services";
import { getProduct, getProducts } from "../../services/products";
import type { Product } from "../../types";

const tabs = [
  { label: "Deskripsi", value: "description" },
  { label: "Informasi Tambahan", value: "information" },
];

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { productIds, add } = useCart();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeTab, setActiveTab] = useState("description");
  const [favorite, setFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const productResponse = await getProduct(id);
      if (!productResponse.data) throw new Error("Produk tidak ditemukan");
      const currentProduct = productResponse.data;
      setProduct(currentProduct);
      const [relatedResponse, availableResponse] = await Promise.all([
        getProducts({ category: currentProduct.category, limit: 6 }),
        getProducts({ limit: 20 }),
      ]);
      const relatedCandidates = [...relatedResponse.data, ...availableResponse.data]
        .filter(
          (item, index, items) =>
            item._id !== currentProduct._id &&
            items.findIndex((candidate) => candidate._id === item._id) === index,
        )
        .sort(
          (a, b) =>
            Number(b.category === currentProduct.category) -
            Number(a.category === currentProduct.category),
        );
      setRelated(relatedCandidates.slice(0, 4));
      if (user) {
        const favoriteResponse = await favoritesService.list();
        setFavorite(favoriteResponse.data.some((item) => item._id === id));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedImage(0);
    void load();
  }, [id, user]);

  const requireLogin = () => {
    if (user) return true;
    navigate("/login", { state: { from: `/products/${id}` } });
    return false;
  };

  const addToCart = () => {
    if (!product || !requireLogin()) return;
    if (product.status !== "available") return;
    add(product._id);
    showToast("Barang ditambahkan ke keranjang.", "success");
  };

  const toggleFavorite = async () => {
    if (!product || !requireLogin()) return;
    setFavoriteLoading(true);
    try {
      if (favorite) await favoritesService.remove(product._id);
      else await favoritesService.add(product._id);
      setFavorite((current) => !current);
      showToast(
        favorite ? "Barang dihapus dari favorit." : "Barang ditambahkan ke favorit.",
        "success",
      );
    } catch {
      showToast("Favorit belum dapat diperbarui.", "error");
    } finally {
      setFavoriteLoading(false);
    }
  };

  if (loading) return <ProductDetailSkeleton />;
  if (error || !product)
    return (
      <div className="container-main py-20">
        <ErrorState
          title="Produk tidak ditemukan"
          description="Produk mungkin sudah dihapus atau tautannya tidak tepat."
          onRetry={() => void load()}
        />
      </div>
    );

  const inCart = productIds.includes(product._id);
  const unavailable = product.status !== "available";

  return (
    <>
      <div className="container-main py-8 tablet:py-12">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Link to="/" className="hover:text-ink">
            Home
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-ink">
            Shop
          </Link>
          <span>/</span>
          <span className="text-ink">{product.name}</span>
        </nav>

        <section className="grid items-start gap-10 desktop:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] desktop:gap-16">
          <div>
            <div className="grid aspect-square place-items-center overflow-hidden rounded-3xl border border-[#e8e9e5] bg-[#f5f5f2]">
              <img
                src={product.images[selectedImage]}
                alt={`${product.name} - ${imageLabels[selectedImage]}`}
                className="h-full w-full object-contain p-5 tablet:p-10"
              />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 tablet:gap-3">
              {product.images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  onClick={() => setSelectedImage(index)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-[#f5f5f2] ${
                    selectedImage === index ? "border-ink" : "border-transparent"
                  }`}
                  aria-label={`Lihat foto ${imageLabels[index]}`}
                >
                  <img src={image} alt="" className="h-full w-full object-contain p-1" />
                </button>
              ))}
            </div>
          </div>

          <div className="desktop:sticky desktop:top-28">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {product.brand}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] tablet:text-4xl">
                {product.name}
              </h1>
            </div>

            <p className="mt-6 text-3xl font-extrabold">{formatRupiah(product.price)}</p>

            <div className="mt-7">
              <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
              <div className="min-h-48 py-6">
                {activeTab === "description" && <ProductInformation product={product} />}
                {activeTab === "information" && <DamageInformation product={product} />}
              </div>
            </div>

            <div className="mt-7 flex gap-3">
              <Button
                onClick={addToCart}
                disabled={unavailable || inCart}
                className="flex-1 rounded-[10px]"
              >
                {unavailable
                  ? product.status === "sold"
                    ? "Terjual"
                    : "Sedang Diproses"
                  : inCart
                    ? "Sudah di Keranjang"
                    : "Tambahkan ke Keranjang"}
              </Button>
              <button
                onClick={() => void toggleFavorite()}
                disabled={favoriteLoading}
                aria-pressed={favorite}
                aria-label={favorite ? "Hapus dari favorit" : "Tambahkan ke favorit"}
                className={`grid size-11 shrink-0 place-items-center rounded-full transition ${
                  favorite
                    ? "bg-pink text-white"
                    : "border border-ink bg-white text-ink hover:bg-pink hover:text-white"
                } disabled:opacity-50`}
              >
                <Heart size={21} fill="currentColor" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="border-y border-[#e8e9e5] bg-canvas py-8">
        <div className="container-main grid grid-cols-2 gap-5 desktop:grid-cols-4">
          <ValueItem
            icon={<PackageCheck />}
            title="Stok tunggal"
            text="Satu barang, satu pemilik baru."
          />
          <ValueItem
            icon={<ShieldCheck />}
            title="Kondisi jujur"
            text="Detail minus ditulis apa adanya."
          />
          <ValueItem
            icon={<Truck />}
            title="Ongkir otomatis"
            text="Dihitung sesuai alamat tujuan."
          />
          <ValueItem
            icon={<WalletCards />}
            title="Pembayaran mudah"
            text="QRIS dan transfer bank."
          />
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-main py-16 tablet:py-20">
          <h2 className="display-title text-3xl tablet:text-4xl">Related Products</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 tablet:grid-cols-4 tablet:gap-5">
            {related.map((item) => (
              <ProductCard key={item._id} product={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

const imageLabels = ["Depan", "Belakang", "Samping", "Detail"];

function ProductInformation({ product }: { product: Product }) {
  const rows = [
    ["Lebar dada", formatSize(product.size.chest)],
    ["Panjang badan", `PB ${product.size.length} cm`],
    ["Kondisi", `Grade ${product.condition.grade}`],
    ["Berat", `${product.weight} gram`],
    ["Kategori", product.category],
    ["Brand", product.brand],
  ];
  return (
    <dl>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-6 border-b border-[#e8e9e5] py-3 text-sm"
        >
          <dt className="text-muted">{label}</dt>
          <dd className="font-semibold capitalize">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DamageInformation({ product }: { product: Product }) {
  const damagePoints = product.condition.minusTags.length
    ? product.condition.minusTags
    : ["Tidak ada kerusakan yang tercatat"];

  return (
    <ul className="space-y-3 text-sm text-muted">
      {damagePoints.map((point) => (
        <li key={point} className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-pink" />
          <span className="leading-6">{point}</span>
        </li>
      ))}
    </ul>
  );
}

function ValueItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      {icon}
      <div>
        <h3 className="text-sm font-extrabold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
      </div>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="container-main grid gap-10 py-12 desktop:grid-cols-2">
      <div>
        <Skeleton className="aspect-square w-full" />
        <div className="mt-3 grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square" />
          ))}
        </div>
      </div>
      <div className="space-y-5 pt-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-12 w-44" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
