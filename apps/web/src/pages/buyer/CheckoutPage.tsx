import { Check, MapPin, PackageCheck, Plus, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { STORE_LOCATION } from "../../lib/constants";
import { formatRupiah } from "../../lib/format";
import { addressesService, ordersService } from "../../services";
import { ApiError } from "../../services/api";
import { getProduct } from "../../services/products";
import type { Product, ShippingAddress } from "../../types";

type AddressForm = Omit<ShippingAddress, "_id">;

const emptyAddress: AddressForm = {
  label: "",
  recipientName: "",
  phone: "",
  province: "",
  city: "",
  district: "",
  address: "",
  postalCode: "",
};

export function CheckoutPage() {
  const { user } = useAuth();
  const { selectedIds, removeMany } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [courier, setCourier] = useState("jne");
  const [service, setService] = useState("reg");
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>({
    ...emptyAddress,
    recipientName: user?.name || "",
    phone: user?.phone || "",
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [checkoutErrors, setCheckoutErrors] = useState<Record<string, string>>({});
  const [confirmUsedItem, setConfirmUsedItem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unavailableOpen, setUnavailableOpen] = useState(false);

  useEffect(() => {
    Promise.all([Promise.all(selectedIds.map((id) => getProduct(id))), addressesService.list()])
      .then(([productResponses, addressResponse]) => {
        setProducts(
          productResponses
            .map((response) => response.data)
            .filter((product): product is Product => Boolean(product)),
        );
        setAddresses(addressResponse.data);
        setSelectedAddressId(addressResponse.data[0]?._id || "");
      })
      .finally(() => setLoading(false));
  }, [selectedIds.join(",")]);

  useEffect(() => {
    if (!selectedAddressId || !selectedIds.length) return;
    setEstimating(true);
    ordersService
      .estimate({
        shippingAddressId: selectedAddressId,
        courier,
        service,
        productIds: selectedIds,
      })
      .then((response) => setShippingCost(response.data.shippingCost))
      .catch(() => showToast("Ongkir belum dapat dihitung.", "error"))
      .finally(() => setEstimating(false));
  }, [selectedAddressId, courier, service, selectedIds.join(",")]);

  const subtotal = useMemo(
    () => products.reduce((total, product) => total + product.price, 0),
    [products],
  );
  const total = subtotal + shippingCost;

  const updateAddress = (key: keyof AddressForm, value: string) =>
    setAddressForm((current) => ({ ...current, [key]: value }));

  const saveAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateAddress(addressForm);
    setAddressErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      const response = await addressesService.create(addressForm);
      setAddresses((current) => [...current, response.data]);
      setSelectedAddressId(response.data._id);
      setAddressOpen(false);
      setAddressForm({
        ...emptyAddress,
        recipientName: user?.name || "",
        phone: user?.phone || "",
      });
      showToast("Alamat baru berhasil disimpan.", "success");
    } catch (error) {
      if (error instanceof ApiError) setAddressErrors(error.errors);
      else showToast("Alamat belum dapat disimpan.", "error");
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await addressesService.remove(id);
      const next = addresses.filter((address) => address._id !== id);
      setAddresses(next);
      if (selectedAddressId === id) setSelectedAddressId(next[0]?._id || "");
      showToast("Alamat dihapus.", "success");
    } catch {
      showToast("Alamat belum dapat dihapus.", "error");
    }
  };

  const createOrder = async () => {
    if (!selectedAddressId || !confirmUsedItem || !products.length) return;
    if (products.some((product) => product.status !== "available")) {
      setUnavailableOpen(true);
      return;
    }
    setCheckoutErrors({});
    setSubmitting(true);
    try {
      const response = await ordersService.create({
        productIds: selectedIds,
        shippingAddressId: selectedAddressId,
        courier,
        service,
        confirmUsedItem: true,
      });
      removeMany(selectedIds);
      navigate(`/orders/${response.data._id}/pay`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setUnavailableOpen(true);
      else if (error instanceof ApiError && error.status === 400) {
        setCheckoutErrors(error.errors);
        showToast(error.message, "error");
      } else showToast("Pesanan belum dapat dibuat.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <CheckoutSkeleton />;
  if (!products.length)
    return (
      <section className="container-main py-20">
        <EmptyState
          title="Belum ada barang untuk checkout"
          description="Pilih setidaknya satu barang dari keranjang."
          action={
            <Link
              to="/cart"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-5 text-sm font-bold text-white"
            >
              Kembali ke keranjang
            </Link>
          }
        />
      </section>
    );

  return (
    <section className="container-main py-12 tablet:py-16">
      <nav className="mb-5 text-xs text-muted">
        <Link to="/cart" className="hover:text-ink">
          Keranjang
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">Checkout</span>
      </nav>
      <h1 className="display-title text-5xl leading-[0.9] tablet:text-6xl">
        Selesaikan <span className="font-display font-normal italic text-pink">Pesananmu</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
        Periksa alamat, barang, dan pengiriman sebelum membuat pesanan.
      </p>

      <div className="mt-10 grid items-start gap-8 desktop:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <CheckoutSection number="1" icon={<MapPin />} title="Alamat dan penerima">
            <div className="grid gap-3 tablet:grid-cols-2">
              {addresses.map((address) => (
                <div key={address._id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedAddressId(address._id)}
                    className={`relative min-h-36 w-full rounded-none border bg-white p-5 text-left transition ${
                      selectedAddressId === address._id
                        ? "border-[#4b4b4b]"
                        : "border-[#deded9] hover:border-[#9a9a94]"
                    }`}
                  >
                    {selectedAddressId === address._id && (
                      <span className="absolute right-12 top-4 grid size-6 place-items-center rounded-full bg-ink text-white">
                        <Check size={14} />
                      </span>
                    )}
                    <p className="text-xs font-bold uppercase tracking-wider">
                      {address.label || "Alamat"}
                    </p>
                    <p className="mt-3 font-extrabold">{address.recipientName}</p>
                    <p className="mt-1 text-xs text-muted">{address.phone}</p>
                    <p className="mt-2 pr-6 text-xs leading-5 text-muted">
                      {address.address}, {address.district}, {address.city}, {address.province}{" "}
                      {address.postalCode}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAddress(address._id)}
                    className="absolute right-3 top-3 z-10 grid size-7 place-items-center text-muted transition hover:text-pink"
                    aria-label={`Hapus alamat ${address.label || ""}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAddressOpen(true)}
              className="mt-4 inline-flex min-h-11 items-center gap-2 px-0 text-sm font-bold text-pink"
            >
              <Plus size={17} /> Tambah alamat baru
            </button>
          </CheckoutSection>

          <CheckoutSection number="2" icon={<PackageCheck />} title="Detail barang">
            <div className="divide-y divide-[#e8e9e5]">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="grid grid-cols-[74px_1fr_auto] items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="aspect-[4/5] bg-[#f1f1ed]">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">{product.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      LD {product.size.chest} cm · PB {product.size.length} cm
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Grade {product.condition.grade}
                      {product.condition.minusTags.length
                        ? ` · ${product.condition.minusTags.join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <strong className="text-sm">{formatRupiah(product.price)}</strong>
                </div>
              ))}
            </div>
          </CheckoutSection>

          <CheckoutSection number="3" icon={<Truck />} title="Shipping method">
            <div className="grid gap-4 tablet:grid-cols-2">
              <Select
                label="Kurir"
                value={courier}
                onChange={(event) => {
                  const nextCourier = event.target.value;
                  setCourier(nextCourier);
                  setService(shippingOptions[nextCourier][0].value);
                }}
                options={[
                  { label: "JNE", value: "jne" },
                  { label: "J&T Express", value: "jnt" },
                  { label: "SiCepat", value: "sicepat" },
                ]}
                className="rounded-none border-[#bdbdbd]"
              />
              <Select
                label="Layanan"
                value={service}
                onChange={(event) => setService(event.target.value)}
                options={shippingOptions[courier]}
                className="rounded-none border-[#bdbdbd]"
              />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-none border border-[#4b4b4b] bg-white p-5">
              <span>
                <strong className="block">
                  {courier.toUpperCase()} ·{" "}
                  {shippingOptions[courier].find((option) => option.value === service)?.label}
                </strong>
                <span className="mt-1 block text-xs text-muted">
                  Dikirim dari {STORE_LOCATION} · estimasi{" "}
                  {fastServices.includes(service) ? "1–2" : "2–4"} hari
                </span>
              </span>
              <span className="font-bold">
                {estimating ? "Menghitung..." : formatRupiah(shippingCost)}
              </span>
            </div>
          </CheckoutSection>
        </div>

        <aside className="border border-[#e8e9e5] bg-white p-6 shadow-[0_10px_30px_rgba(25,26,24,0.06)] desktop:sticky desktop:top-28">
          <h2 className="text-lg font-extrabold">Rincian Biaya</h2>
          <dl className="mt-6 space-y-5 text-sm">
            <CostRow
              label={`Subtotal (${products.length} barang)`}
              value={formatRupiah(subtotal)}
            />
            <CostRow
              label="Pengiriman"
              value={estimating ? "Menghitung..." : formatRupiah(shippingCost)}
            />
            <div className="flex justify-between gap-4 border-t border-[#e8e9e5] pt-5 text-base">
              <dt className="font-extrabold">Total</dt>
              <dd className="font-extrabold">{formatRupiah(total)}</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-lg bg-canvas p-4">
            <Checkbox
              checked={confirmUsedItem}
              onChange={(event) => setConfirmUsedItem(event.target.checked)}
            >
              Saya mengerti bahwa barang yang dibeli adalah barang preloved.
            </Checkbox>
          </div>
          {Object.keys(checkoutErrors).length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-red-600">
              {Object.entries(checkoutErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          )}
          <Button
            className="mt-6 w-full rounded-[10px]"
            disabled={!selectedAddressId || !confirmUsedItem || estimating || submitting}
            onClick={() => void createOrder()}
          >
            {submitting ? "Membuat pesanan..." : "Buat Pesanan"}
          </Button>
        </aside>
      </div>

      <Modal open={addressOpen} title="Tambah Alamat Baru" onClose={() => setAddressOpen(false)}>
        <form onSubmit={saveAddress} className="grid gap-4 tablet:grid-cols-2">
          <Input
            label="Label alamat"
            value={addressForm.label}
            onChange={(event) => updateAddress("label", event.target.value)}
            placeholder="Rumah, Kos, Kantor"
          />
          <Input
            label="Nama penerima"
            value={addressForm.recipientName}
            onChange={(event) => updateAddress("recipientName", event.target.value)}
            error={addressErrors.recipientName}
          />
          <Input
            label="Nomor HP"
            value={addressForm.phone}
            onChange={(event) => updateAddress("phone", event.target.value)}
            error={addressErrors.phone}
          />
          <Input
            label="Kode pos"
            value={addressForm.postalCode}
            onChange={(event) => updateAddress("postalCode", event.target.value)}
            error={addressErrors.postalCode}
          />
          <Input
            label="Provinsi"
            value={addressForm.province}
            onChange={(event) => updateAddress("province", event.target.value)}
            error={addressErrors.province}
          />
          <Input
            label="Kota"
            value={addressForm.city}
            onChange={(event) => updateAddress("city", event.target.value)}
            error={addressErrors.city}
          />
          <Input
            label="Kecamatan"
            value={addressForm.district}
            onChange={(event) => updateAddress("district", event.target.value)}
            error={addressErrors.district}
          />
          <div className="tablet:col-span-2">
            <Input
              label="Alamat lengkap"
              value={addressForm.address}
              onChange={(event) => updateAddress("address", event.target.value)}
              error={addressErrors.address}
            />
          </div>
          <Button type="submit" className="rounded-[10px] tablet:col-span-2">
            Simpan Alamat
          </Button>
        </form>
      </Modal>

      <Modal
        open={unavailableOpen}
        title="Barang sudah tidak tersedia"
        onClose={() => setUnavailableOpen(false)}
      >
        <p className="text-sm leading-6 text-muted">
          Salah satu barang sedang diproses pembeli lain atau sudah terjual.
        </p>
        <Button className="mt-5 w-full rounded-[10px]" onClick={() => navigate("/shop")}>
          Kembali ke katalog
        </Button>
      </Modal>
    </section>
  );
}

function CheckoutSection({
  number,
  icon,
  title,
  children,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[#e8e9e5] bg-white p-5 tablet:p-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-black text-white">
          {number}
        </span>
        <span className="text-pink">{icon}</span>
        <h2 className="text-lg font-extrabold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function validateAddress(address: AddressForm) {
  const errors: Record<string, string> = {};
  if (address.recipientName.trim().length < 2) errors.recipientName = "Nama penerima wajib diisi";
  if (!/^(?:08|\+62)\d{8,13}$/.test(address.phone.replace(/[\s-]/g, "")))
    errors.phone = "Nomor HP tidak valid";
  if (!/^\d{5}$/.test(address.postalCode)) errors.postalCode = "Kode pos harus 5 digit";
  (["province", "city", "district", "address"] as const).forEach((field) => {
    if (!address[field].trim()) errors[field] = "Field ini wajib diisi";
  });
  return errors;
}

function CheckoutSkeleton() {
  return (
    <div className="container-main grid gap-8 py-16 desktop:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

const shippingOptions: Record<string, { label: string; value: string }[]> = {
  jne: [
    { label: "Regular (REG)", value: "reg" },
    { label: "Yakin Esok Sampai (YES)", value: "yes" },
  ],
  jnt: [
    { label: "Regular", value: "reg" },
    { label: "Express", value: "express" },
  ],
  sicepat: [
    { label: "Regular (REG)", value: "reg" },
    { label: "Best", value: "best" },
  ],
};

const fastServices = ["yes", "express", "best"];
