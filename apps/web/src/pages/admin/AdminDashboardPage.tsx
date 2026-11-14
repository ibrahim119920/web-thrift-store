import {
  ArrowUpRight,
  CircleDollarSign,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../context/AuthContext";
import { CATEGORIES, USE_MOCK } from "../../lib/constants";
import { formatRupiah } from "../../lib/format";
import { orderStatusClass, orderStatusLabel } from "../../lib/order";
import { ordersService } from "../../services";
import {
  createProduct,
  deleteProduct,
  getAdminProducts,
  updateProduct,
} from "../../services/products";
import { ApiError } from "../../services/api";
import { ALLOWED_IMAGE_TYPES, isImageKey, uploadProductImage } from "../../services/uploads";
import type { Order, OrderStatus, Product } from "../../types";

const nextOrderAction: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  paid: { status: "processing", label: "Mulai proses" },
  processing: { status: "shipped", label: "Kirim pesanan" },
  shipped: { status: "completed", label: "Tandai selesai" },
};

type ProductDraft = {
  name: string;
  category: string;
  brand: string;
  price: string;
  sizeLabel: string;
  chest: string;
  length: string;
  weight: string;
  description: string;
  grade: "A" | "B" | "C";
  conditionDescription: string;
  minusTags: string;
  sellerNote: string;
};

const PHOTO_ANGLES = ["Depan", "Belakang", "Samping", "Detail"];

// key: object key S3 yang dikirim ke API; preview: URL yang bisa ditampilkan browser.
type PhotoSlot = { key: string; preview: string; uploading: boolean; error: string };

const emptyPhoto: PhotoSlot = { key: "", preview: "", uploading: false, error: "" };

const emptyDraft: ProductDraft = {
  name: "",
  category: "kemeja",
  brand: "",
  price: "",
  sizeLabel: "",
  chest: "",
  length: "",
  weight: "",
  description: "",
  grade: "A",
  conditionDescription: "",
  minusTags: "",
  sellerNote: "",
};

export function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | "new" | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [productError, setProductError] = useState("");
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

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Hapus produk "${product.name}"?`)) return;
    setProductError("");
    setDeletingProductId(product._id);
    try {
      await deleteProduct(product._id);
      setProducts((current) => current.filter((item) => item._id !== product._id));
    } catch (error) {
      setProductError(error instanceof Error ? error.message : "Produk belum dapat dihapus.");
    } finally {
      setDeletingProductId(null);
    }
  };

  const changeOrderStatus = async (order: Order, status: OrderStatus) => {
    const trackingNumber = (trackingDraft[order._id] ?? "").trim();
    if (status === "shipped" && trackingNumber.length < 3) {
      setOrderError(`Isi nomor resi untuk pesanan ${order.orderNumber} (minimal 3 karakter).`);
      return;
    }
    setOrderError("");
    setUpdatingOrderId(order._id);
    try {
      const response = await ordersService.updateStatus(order._id, {
        status,
        ...(status === "shipped" ? { trackingNumber } : {}),
      });
      setOrders((current) =>
        current.map((item) =>
          item._id === order._id ? { ...item, ...response.data, userId: item.userId } : item,
        ),
      );
      setTrackingDraft((current) => ({ ...current, [order._id]: "" }));
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Status pesanan belum dapat diubah.");
    } finally {
      setUpdatingOrderId(null);
    }
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
              {productError && (
                <p className="border-b border-[#e8e8e3] px-5 py-3 text-xs font-bold text-red-600">
                  {productError}
                </p>
              )}
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
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingProduct(product)}
                                className="inline-flex min-h-9 items-center gap-2 border border-ink px-3 text-[11px] font-bold"
                              >
                                <Pencil size={13} /> Edit
                              </button>
                              <button
                                type="button"
                                disabled={
                                  product.status !== "available" ||
                                  deletingProductId === product._id
                                }
                                title={
                                  product.status !== "available"
                                    ? "Hanya produk tersedia yang dapat dihapus"
                                    : undefined
                                }
                                onClick={() => void removeProduct(product)}
                                className="inline-flex min-h-9 items-center gap-2 border border-red-600 px-3 text-[11px] font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 size={13} />
                                {deletingProductId === product._id ? "Menghapus..." : "Hapus"}
                              </button>
                            </div>
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
                <h2 className="font-extrabold">Kelola pesanan</h2>
                <p className="mt-1 text-xs text-muted">
                  Alur status: dibayar → diproses → dikirim (wajib nomor resi) → selesai.
                </p>
              </div>
              {orderError && (
                <p className="border-b border-[#f0c9c9] bg-[#fbeaea] px-5 py-3 text-xs font-semibold text-[#7d2626]">
                  {orderError}
                </p>
              )}
              {loading ? (
                <div className="p-5">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : orders.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-muted">Belum ada pesanan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-xs">
                    <thead className="bg-canvas text-[10px] uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-5 py-3">Pesanan</th>
                        <th className="px-5 py-3">Pembeli</th>
                        <th className="px-5 py-3">Barang</th>
                        <th className="px-5 py-3">Total</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => {
                        const action = nextOrderAction[order.status];
                        const buyer =
                          typeof order.userId === "object" && order.userId !== null ? order.userId : null;
                        const busy = updatingOrderId === order._id;
                        return (
                          <tr key={order._id} className="border-t border-[#ecece7] align-top">
                            <td className="px-5 py-4 font-bold">{order.orderNumber}</td>
                            <td className="px-5 py-4">
                              <p className="font-semibold">{buyer?.name ?? "-"}</p>
                              <p className="mt-1 text-[10px] text-muted">{buyer?.email ?? ""}</p>
                              {buyer?.phone && <p className="text-[10px] text-muted">{buyer.phone}</p>}
                            </td>
                            <td className="px-5 py-4">{order.items.length} item</td>
                            <td className="px-5 py-4 font-semibold">{formatRupiah(order.total)}</td>
                            <td className="px-5 py-4">
                              <span
                                className={`rounded-full px-3 py-2 text-[10px] font-bold ${orderStatusClass(order.status)}`}
                              >
                                {orderStatusLabel(order.status)}
                              </span>
                              {order.shipping.trackingNumber && (
                                <p className="mt-2 text-[10px] text-muted">
                                  Resi: {order.shipping.trackingNumber}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {order.status === "processing" && (
                                <input
                                  value={trackingDraft[order._id] ?? ""}
                                  onChange={(event) =>
                                    setTrackingDraft((current) => ({
                                      ...current,
                                      [order._id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Nomor resi"
                                  className="mb-2 min-h-9 w-40 border border-[#deded9] px-3 text-xs outline-none focus:border-ink"
                                />
                              )}
                              {action ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void changeOrderStatus(order, action.status)}
                                  className="inline-flex min-h-9 items-center border border-ink bg-ink px-3 text-[11px] font-bold text-white disabled:opacity-50"
                                >
                                  {busy ? "Menyimpan..." : action.label}
                                </button>
                              ) : order.status === "waiting_payment" ? (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-muted">Menunggu pembayaran pembeli</p>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      if (window.confirm(`Batalkan pesanan ${order.orderNumber}? Barang akan tersedia kembali.`)) {
                                        void changeOrderStatus(order, "cancelled");
                                      }
                                    }}
                                    className="inline-flex min-h-9 items-center border border-[#7d2626] px-3 text-[11px] font-bold text-[#7d2626] disabled:opacity-50"
                                  >
                                    {busy ? "Menyimpan..." : "Batalkan"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted">Tidak ada aksi</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
          description: product.description,
          grade: product.condition.grade,
          conditionDescription: product.condition.description,
          minusTags: product.condition.minusTags.join(", "),
          sellerNote: product.condition.sellerNote,
        }
      : emptyDraft,
  );
  const [photos, setPhotos] = useState<PhotoSlot[]>(() =>
    PHOTO_ANGLES.map((_, index) =>
      product?.images[index]
        ? {
            ...emptyPhoto,
            key: product.imageKeys?.[index] ?? product.images[index],
            preview: product.images[index],
          }
        : emptyPhoto,
    ),
  );
  const [photosChanged, setPhotosChanged] = useState(!product);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const setPhoto = (index: number, slot: Partial<PhotoSlot>) =>
    setPhotos((current) =>
      current.map((item, position) => (position === index ? { ...item, ...slot } : item)),
    );

  // Foto langsung di-upload ke S3 begitu dipilih; yang disimpan di draft hanya object key-nya.
  const choosePhoto = async (index: number, file: File | undefined) => {
    if (!file) return;
    setPhotosChanged(true);
    setPhoto(index, { uploading: true, error: "" });
    try {
      const key = await uploadProductImage(file);
      setPhoto(index, { key, preview: URL.createObjectURL(file), uploading: false });
    } catch (uploadError) {
      setPhoto(index, {
        uploading: false,
        error: uploadError instanceof Error ? uploadError.message : "Upload foto gagal.",
      });
    }
  };

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
    if (photos.some((photo) => photo.uploading)) {
      setError("Tunggu sampai semua foto selesai di-upload.");
      return;
    }
    if (photos.some((photo) => !photo.key)) {
      setError("Upload tepat 4 foto (depan, belakang, samping, detail).");
      return;
    }
    // Produk seed lama menyimpan URL eksternal; API hanya menerima object key S3.
    if (photosChanged && !USE_MOCK && photos.some((photo) => !isImageKey(photo.key))) {
      setError("Produk ini masih memakai foto lama. Ganti keempat fotonya agar bisa disimpan.");
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
      description: draft.description.trim(),
      // Saat edit tanpa ganti foto, field images tidak dikirim supaya foto lama tetap dipakai.
      ...(photosChanged ? { images: photos.map((photo) => photo.key) } : {}),
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
    } catch (saveError) {
      setError(
        saveError instanceof ApiError
          ? saveError.message
          : "Produk belum dapat disimpan. Coba lagi.",
      );
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
              label="Grade kondisi"
              value={draft.grade}
              onChange={(value) => update("grade", value as ProductDraft["grade"])}
              options={["A", "B", "C"].map((value) => ({ value, label: `Grade ${value}` }))}
            />
            <div className="tablet:col-span-2">
              <span className="mb-2 block text-xs font-semibold">
                4 foto barang (JPG, PNG, atau WebP, maks. 5 MB)
              </span>
              <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
                {PHOTO_ANGLES.map((angle, index) => (
                  <PhotoPicker
                    key={angle}
                    angle={angle}
                    slot={photos[index]}
                    onPick={(file) => void choosePhoto(index, file)}
                  />
                ))}
              </div>
            </div>
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

function PhotoPicker({
  angle,
  slot,
  onPick,
}: {
  angle: string;
  slot: PhotoSlot;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <label className="block cursor-pointer">
      <div className="relative grid aspect-square place-items-center overflow-hidden border border-dashed border-[#d8d8d2] bg-canvas hover:border-ink">
        {slot.preview ? (
          <img src={slot.preview} alt={`Foto ${angle}`} className="size-full object-cover" />
        ) : (
          <ImagePlus size={22} className="text-muted" />
        )}
        {slot.uploading && (
          <span className="absolute inset-0 grid place-items-center bg-white/75 text-[10px] font-bold">
            Mengupload...
          </span>
        )}
      </div>
      <span className="mt-1 block text-[10px] font-bold text-muted">
        {angle}
        {slot.preview ? " · ganti" : ""}
      </span>
      {slot.error && <span className="block text-[10px] font-bold text-[#8b2828]">{slot.error}</span>}
      <input
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        disabled={slot.uploading}
        className="sr-only"
        onChange={(event) => {
          onPick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
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
