import {
  ArrowUpRight,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../context/AuthContext";
import { CATEGORIES } from "../../lib/constants";
import { formatRupiah } from "../../lib/format";
import { orderStatusClass, orderStatusLabel } from "../../lib/order";
import { ordersService } from "../../services";
import { createProduct, getAdminProducts, updateProduct } from "../../services/products";
import type { Order, Product, ProductStatus } from "../../types";

type ProductDraft = {
  name: string;
  category: string;
  brand: string;
  price: string;
  sizeLabel: string;
  chest: string;
  length: string;
  weight: string;
  status: ProductStatus;
  description: string;
  grade: "A" | "B" | "C";
  conditionDescription: string;
  minusTags: string;
  sellerNote: string;
  image: string;
};

const emptyDraft: ProductDraft = {
  name: "",
  category: "kemeja",
  brand: "",
  price: "",
  sizeLabel: "",
  chest: "",
  length: "",
  weight: "",
  status: "available",
  description: "",
  grade: "A",
  conditionDescription: "",
  minusTags: "",
  sellerNote: "",
  image: "/assets/5656c.png",
};

export function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [productResponse, orderResponse] = await Promise.all([
        getAdminProducts(),
        ordersService.adminListAll(),
      ]);
      setProducts(productResponse.data);
      setOrders(orderResponse.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const revenue = useMemo(
    () =>
      orders
        .filter((order) => !["waiting_payment", "cancelled"].includes(order.status))
        .reduce((total, order) => total + order.total, 0),
    [orders],
  );

  const saveProduct = async (product: Product) => {
    setProducts((current) => {
      const exists = current.some((item) => item._id === product._id);
      return exists
        ? current.map((item) => (item._id === product._id ? product : item))
        : [product, ...current];
    });
    setEditingProduct(null);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f4] desktop:grid desktop:grid-cols-[220px_1fr]">
      <aside className="bg-ink p-5 text-white desktop:sticky desktop:top-0 desktop:flex desktop:h-screen desktop:flex-col desktop:p-6">
        <Link to="/admin" className="text-lg font-black tracking-[-0.06em]">
          WANT<span className="text-pink">TO</span>SELL
          <span className="ml-2 font-['Instrument_Serif:Italic'] text-sm font-normal italic text-lime">
            admin
          </span>
        </Link>

        <nav className="mt-5 flex gap-2 overflow-x-auto desktop:mt-12 desktop:block desktop:space-y-2">
          <AdminLink to="/admin" active icon={<LayoutDashboard size={17} />}>
            Dashboard
          </AdminLink>
          <AdminLink to="/shop" icon={<Store size={17} />}>
            Lihat storefront
          </AdminLink>
        </nav>

        <div className="mt-6 border-t border-white/15 pt-5 desktop:mt-auto">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center border border-white/30 bg-white/10 text-sm font-black">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{user?.name}</p>
              <p className="mt-1 truncate text-[10px] text-white/50">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-4 flex items-center gap-2 text-xs font-bold text-white/70 hover:text-white"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      <main className="min-w-0 p-5 tablet:p-8 desktop:p-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-black uppercase leading-[0.88] tracking-[-0.065em]">
            Kelola
            <span className="ml-2 font-['Instrument_Serif:Italic'] font-normal normal-case italic text-pink">
              toko
            </span>
          </h1>
          <Link
            to="/shop"
            className="inline-flex min-h-11 items-center gap-2 border border-ink bg-white px-5 text-xs font-bold"
          >
            Buka storefront <ArrowUpRight size={15} />
          </Link>
        </header>

        {error ? (
          <div className="mt-8">
            <ErrorState onRetry={() => void load()} />
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4">
              <Metric
                icon={<ShoppingBag size={19} />}
                label="Total produk"
                value={loading ? "—" : String(products.length)}
              />
              <Metric
                icon={<PackageCheck size={19} />}
                label="Stok tersedia"
                value={
                  loading
                    ? "—"
                    : String(products.filter((item) => item.status === "available").length)
                }
              />
              <Metric
                icon={<ShoppingBag size={19} />}
                label="Total pesanan"
                value={loading ? "—" : String(orders.length)}
              />
              <Metric
                icon={<CircleDollarSign size={19} />}
                label="Nilai transaksi"
                value={loading ? "—" : formatRupiah(revenue)}
              />
            </section>

            <section className="mt-7 overflow-hidden border border-[#deded9] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e8e3] px-5 py-4">
                <div>
                  <h2 className="font-extrabold">Inventori produk</h2>
                  <p className="mt-1 text-xs text-muted">
                    Ukuran produk selalu dicatat dalam sentimeter.
                  </p>
                </div>
                <Button onClick={() => setEditingProduct("new")}>
                  <Plus size={16} /> Tambah produk
                </Button>
              </div>
              {loading ? (
                <div className="p-5">
                  <Skeleton className="h-72 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-xs">
                    <thead className="bg-canvas text-[10px] uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-5 py-3">Produk</th>
                        <th className="px-5 py-3">Jenis</th>
                        <th className="px-5 py-3">Ukuran aktual</th>
                        <th className="px-5 py-3">Harga</th>
                        <th className="px-5 py-3">Ketersediaan</th>
                        <th className="px-5 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product._id} className="border-t border-[#ecece7]">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={product.images[0]}
                                alt=""
                                className="size-10 object-cover"
                              />
                              <div>
                                <p className="font-bold">{product.name}</p>
                                <p className="mt-1 text-[10px] text-muted">{product.brand}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 capitalize">{product.category}</td>
                          <td className="px-5 py-3">
                            LD {product.size.chest} cm · PB {product.size.length} cm
                          </td>
                          <td className="px-5 py-3 font-semibold">{formatRupiah(product.price)}</td>
                          <td className="px-5 py-3">
                            <ProductStatus status={product.status} />
                          </td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => setEditingProduct(product)}
                              className="inline-flex min-h-9 items-center gap-2 border border-ink px-3 text-[11px] font-bold"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-7 overflow-hidden border border-[#deded9] bg-white">
              <div className="border-b border-[#e8e8e3] px-5 py-4">
                <h2 className="font-extrabold">Aktivitas pesanan terbaru</h2>
                <p className="mt-1 text-xs text-muted">Ringkasan aktivitas toko terbaru.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-canvas text-[10px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-5 py-3">Pesanan</th>
                      <th className="px-5 py-3">Barang</th>
                      <th className="px-5 py-3">Total</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order._id} className="border-t border-[#ecece7]">
                        <td className="px-5 py-4 font-bold">{order.orderNumber}</td>
                        <td className="px-5 py-4">{order.items.length} item</td>
                        <td className="px-5 py-4 font-semibold">{formatRupiah(order.total)}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-2 text-[10px] font-bold ${orderStatusClass(order.status)}`}
                          >
                            {orderStatusLabel(order.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {editingProduct && (
        <ProductEditor
          product={editingProduct === "new" ? undefined : editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={saveProduct}
        />
      )}
    </div>
  );
}

function ProductEditor({
  product,
  onClose,
  onSave,
}: {
  product?: Product;
  onClose: () => void;
  onSave: (product: Product) => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(() =>
    product
      ? {
          name: product.name,
          category: product.category,
          brand: product.brand,
          price: String(product.price),
          sizeLabel: product.size.label ?? "",
          chest: String(product.size.chest),
          length: String(product.size.length),
          weight: String(product.weight),
          status: product.status,
          description: product.description,
          grade: product.condition.grade,
          conditionDescription: product.condition.description,
          minusTags: product.condition.minusTags.join(", "),
          sellerNote: product.condition.sellerNote,
          image: product.images[0] || "/assets/5656c.png",
        }
      : emptyDraft,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !draft.name.trim() ||
      !draft.brand.trim() ||
      !draft.price ||
      !draft.sizeLabel.trim() ||
      !draft.chest ||
      !draft.length ||
      !draft.description.trim()
    ) {
      setError("Lengkapi nama, brand, harga, label ukuran, ukuran cm, dan deskripsi.");
      return;
    }
    setSaving(true);
    setError("");
    const body: Partial<Product> = {
      name: draft.name.trim(),
      category: draft.category,
      brand: draft.brand.trim(),
      price: Number(draft.price),
      size: {
        label: draft.sizeLabel.trim(),
        chest: Number(draft.chest),
        length: Number(draft.length),
      },
      weight: Number(draft.weight) || 300,
      status: draft.status,
      description: draft.description.trim(),
      images: [draft.image.trim() || "/assets/5656c.png"],
      condition: {
        grade: draft.grade,
        description: draft.conditionDescription.trim() || "Kondisi sesuai foto.",
        minusTags: draft.minusTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        sellerNote: draft.sellerNote.trim(),
      },
    };
    try {
      const response = product ? await updateProduct(product._id, body) : await createProduct(body);
      onSave(response.data);
    } catch {
      setError("Produk belum dapat disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 tablet:p-8">
      <div className="ml-auto min-h-full w-full max-w-3xl bg-white p-6 tablet:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-[#e8e8e3] pb-5">
          <div>
            <p className="text-xs font-bold text-muted">
              {product ? "EDIT PRODUK" : "PRODUK BARU"}
            </p>
            <h2 className="mt-2 text-3xl font-black">{product ? product.name : "Tambah barang"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center border border-ink"
            aria-label="Tutup form"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-7">
          <div className="grid gap-5 tablet:grid-cols-2">
            <EditorField
              label="Nama barang"
              value={draft.name}
              onChange={(value) => update("name", value)}
            />
            <EditorSelect
              label="Jenis barang"
              value={draft.category}
              onChange={(value) => update("category", value)}
              options={CATEGORIES.filter((item) => item !== "semua").map((item) => ({
                value: item,
                label: item.charAt(0).toUpperCase() + item.slice(1),
              }))}
            />
            <EditorField
              label="Brand"
              value={draft.brand}
              onChange={(value) => update("brand", value)}
            />
            <EditorField
              label="Harga (Rp)"
              value={draft.price}
              type="number"
              onChange={(value) => update("price", value)}
            />
            <EditorField
              label="Label ukuran (mis. S, M, L, XL)"
              value={draft.sizeLabel}
              onChange={(value) => update("sizeLabel", value)}
            />
            <EditorField
              label="Lebar dada / LD (cm)"
              value={draft.chest}
              type="number"
              onChange={(value) => update("chest", value)}
            />
            <EditorField
              label="Panjang badan / PB (cm)"
              value={draft.length}
              type="number"
              onChange={(value) => update("length", value)}
            />
            <EditorField
              label="Berat (gram)"
              value={draft.weight}
              type="number"
              onChange={(value) => update("weight", value)}
            />
            <EditorSelect
              label="Ketersediaan"
              value={draft.status}
              onChange={(value) => update("status", value as ProductStatus)}
              options={[
                { value: "available", label: "Tersedia" },
                { value: "reserved", label: "Dipesan" },
                { value: "sold", label: "Terjual" },
              ]}
            />
            <EditorSelect
              label="Grade kondisi"
              value={draft.grade}
              onChange={(value) => update("grade", value as ProductDraft["grade"])}
              options={["A", "B", "C"].map((value) => ({ value, label: `Grade ${value}` }))}
            />
            <EditorField
              label="URL gambar utama"
              value={draft.image}
              onChange={(value) => update("image", value)}
            />
            <EditorField
              label="Deskripsi barang"
              value={draft.description}
              onChange={(value) => update("description", value)}
              multiline
            />
            <EditorField
              label="Deskripsi kondisi"
              value={draft.conditionDescription}
              onChange={(value) => update("conditionDescription", value)}
              multiline
            />
            <EditorField
              label="Minus barang, pisahkan dengan koma"
              value={draft.minusTags}
              onChange={(value) => update("minusTags", value)}
              multiline
            />
            <EditorField
              label="Catatan penjual"
              value={draft.sellerNote}
              onChange={(value) => update("sellerNote", value)}
              multiline
            />
          </div>
          {error && <p className="mt-5 text-xs font-bold text-[#8b2828]">{error}</p>}
          <div className="mt-7 flex flex-wrap gap-3 border-t border-[#e8e8e3] pt-6">
            <Button disabled={saving}>{saving ? "Menyimpan..." : "Simpan produk"}</Button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 border border-ink px-5 text-sm font-bold"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditorField({
  label,
  value,
  type = "text",
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const classes =
    "w-full border border-[#d8d8d2] bg-white px-4 text-sm outline-none focus:border-ink";
  return (
    <label>
      <span className="mb-2 block text-xs font-semibold">{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${classes} resize-y py-3`}
        />
      ) : (
        <input
          type={type}
          min={type === "number" ? "0" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${classes} min-h-12`}
        />
      )}
    </label>
  );
}

function EditorSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-semibold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full border border-[#d8d8d2] bg-white px-4 text-sm outline-none focus:border-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminLink({
  to,
  active = false,
  icon,
  children,
}: {
  to: string;
  active?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-11 shrink-0 items-center gap-3 px-4 text-xs font-bold transition ${
        active ? "bg-lime text-ink" : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="border border-[#deded9] bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <span className="grid size-9 place-items-center rounded-full bg-lime">{icon}</span>
      </div>
      <p className="mt-5 text-2xl font-black tracking-[-0.04em]">{value}</p>
    </article>
  );
}

function ProductStatus({ status }: { status: Product["status"] }) {
  const classes =
    status === "available"
      ? "bg-lime"
      : status === "reserved"
        ? "bg-[#fff1bd]"
        : "bg-[#e4e4df] text-muted";
  return (
    <span className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase ${classes}`}>
      {status === "available" ? "Tersedia" : status === "reserved" ? "Dipesan" : "Terjual"}
    </span>
  );
}
