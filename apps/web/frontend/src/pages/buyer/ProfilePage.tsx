import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { addressesService, ordersService } from "../../services";
import type { ShippingAddress } from "../../types";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";

type AddressInput = {
  recipientName: string;
  phone: string;
  address: string;
};

const emptyAddress: AddressInput = { recipientName: "", phone: "", address: "" };

export function ProfilePage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [form, setForm] = useState<AddressInput>({
    ...emptyAddress,
    recipientName: user?.name || "",
    phone: user?.phone || "",
  });
  const [errors, setErrors] = useState<Partial<AddressInput>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [addressResponse, orderResponse] = await Promise.all([
        addressesService.list(),
        ordersService.list(),
      ]);
      setAddresses(addressResponse.data);
      setOrderCount(orderResponse.data.length);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const initials = useMemo(
    () =>
      (user?.name || "U")
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [user?.name],
  );
  const nameParts = (user?.name || "User").split(" ");

  const update = (key: keyof AddressInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const addAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Partial<AddressInput> = {};
    if (!form.recipientName.trim()) nextErrors.recipientName = "Nama penerima wajib diisi.";
    if (!/^[+\d][\d\s-]{7,}$/.test(form.phone.trim()))
      nextErrors.phone = "Masukkan nomor HP yang valid.";
    if (form.address.trim().length < 10) nextErrors.address = "Tulis alamat lebih lengkap.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setSaveError("");
    try {
      const response = await addressesService.create({
        label: addresses.length === 0 ? "Alamat utama" : `Alamat ${addresses.length + 1}`,
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        province: "-",
        city: "-",
        district: "-",
        postalCode: "00000",
      });
      setAddresses((current) => [...current, response.data]);
      setForm({ ...emptyAddress, recipientName: user?.name || "", phone: user?.phone || "" });
    } catch {
      setSaveError("Alamat belum dapat disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (id: string) => {
    try {
      await addressesService.remove(id);
      setAddresses((current) => current.filter((address) => address._id !== id));
    } catch {
      setSaveError("Alamat belum dapat dihapus. Coba lagi.");
    }
  };

  return (
    <main className="container-main py-12 tablet:py-16">
      <div>
        <h1 className="text-[44px] font-black uppercase leading-none tracking-[-0.05em]">
          My{" "}
          <span className="font-['Instrument_Serif:Italic'] font-normal normal-case italic text-pink">
            Profile
          </span>
        </h1>
        <p className="mt-3 text-xs text-muted">Beranda / Akun / Informasi pribadi</p>
      </div>

      <section className="mt-9 border-b border-[#e6e6e1] pb-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative grid size-[76px] place-items-center rounded-full border-2 border-ink bg-canvas text-xl font-black">
              {initials}
              <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-white bg-ink">
                <img src="/assets/profile-camera.svg" alt="" width="14" height="14" />
              </span>
            </div>
            <div>
              <h2 className="text-lg font-extrabold">{user?.name || "User"}</h2>
              <p className="mt-1 text-xs text-muted">
                Member WantToSell · <strong className="text-ink">{orderCount} pesanan</strong>
              </p>
            </div>
          </div>
          <a
            href="#alamat"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink px-5 text-sm font-bold"
          >
            <img src="/assets/profile-edit.svg" alt="" width="16" height="16" /> Kelola alamat
          </a>
        </div>

        <div className="mt-8 grid gap-5 tablet:grid-cols-2">
          <ProfileField label="Nama depan" value={nameParts[0]} />
          <ProfileField label="Nama belakang" value={nameParts.slice(1).join(" ") || "-"} />
          <ProfileField label="Nomor HP" value={user?.phone || "-"} />
          <ProfileField label="Email" value={user?.email || "-"} verified />
        </div>
      </section>

      <section id="alamat" className="scroll-mt-32 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-[-0.04em]">Alamat tersimpan</h2>
            <p className="mt-2 text-sm text-muted">
              Alamat pertama digunakan sebagai alamat utama saat checkout.
            </p>
          </div>
          <span className="text-xs font-bold">{addresses.length} ALAMAT</span>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : loadError ? (
          <div className="mt-6">
            <ErrorState onRetry={() => void load()} />
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {addresses.map((address, index) => (
              <article
                key={address._id}
                className={`flex flex-col justify-between gap-5 border p-5 tablet:flex-row tablet:items-center ${
                  index === 0 ? "border-ink bg-canvas" : "border-[#deded9]"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold">{address.label || `Alamat ${index + 1}`}</h3>
                    {index === 0 && (
                      <span className="rounded bg-lime px-2 py-1 text-[10px] font-bold">UTAMA</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold">
                    {address.recipientName} · {address.phone}
                  </p>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
                    {address.address}
                    {[address.district, address.city, address.province, address.postalCode]
                      .filter((value) => value && value !== "-" && value !== "00000")
                      .map((value) => `, ${value}`)
                      .join("")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeAddress(address._id)}
                  className="inline-flex min-h-10 items-center gap-2 self-start text-xs font-bold text-muted transition hover:text-pink"
                >
                  <Trash2 size={15} /> Hapus
                </button>
              </article>
            ))}
          </div>
        )}

        <form onSubmit={addAddress} className="mt-8 bg-lime p-6 tablet:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-ink text-white">
              <Plus size={18} />
            </span>
            <div>
              <h3 className="text-lg font-extrabold">Tambah alamat baru</h3>
              <p className="text-xs text-[#4b4b47]">Pastikan data penerima sudah benar.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-5 tablet:grid-cols-2">
            <AddressField
              label="Nama penerima"
              value={form.recipientName}
              error={errors.recipientName}
              onChange={(value) => update("recipientName", value)}
            />
            <AddressField
              label="Nomor HP"
              value={form.phone}
              error={errors.phone}
              onChange={(value) => update("phone", value)}
            />
            <AddressField
              label="Detail alamat"
              value={form.address}
              error={errors.address}
              onChange={(value) => update("address", value)}
              multiline
            />
          </div>
          <Button className="mt-6 rounded-full" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan alamat"}
          </Button>
          {saveError && <p className="mt-3 text-xs font-semibold text-[#7d2626]">{saveError}</p>}
        </form>
      </section>
    </main>
  );
}

function ProfileField({
  label,
  value,
  verified,
}: {
  label: string;
  value: string;
  verified?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-[#444]">{label}</p>
      <div className="flex min-h-12 items-center justify-between rounded-lg border border-[#dadada] px-4 text-sm">
        <span>{value}</span>
        {verified && (
          <span className="rounded-md bg-lime px-2 py-1 text-[10px] font-bold">Terverifikasi</span>
        )}
      </div>
    </div>
  );
}

function AddressField({
  label,
  value,
  error,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const shared =
    "w-full rounded-lg border border-[#b7bd8d] bg-white px-4 text-sm outline-none focus:border-ink";
  return (
    <label className={multiline ? "tablet:col-span-2" : ""}>
      <span className="mb-2 block text-xs font-semibold">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className={`${shared} resize-y py-3`}
          placeholder="Nama jalan, nomor rumah, kecamatan, kota, provinsi, dan kode pos"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${shared} min-h-12`}
        />
      )}
      {error && <span className="mt-1 block text-xs font-semibold text-[#7d2626]">{error}</span>}
    </label>
  );
}
