import { Ruler, ShieldCheck, Tag, Wallet, Search, Lock, CreditCard, Truck } from "lucide-react";
import { ProductCard } from "@/features/products/product-card";
import { GRADE_LABEL } from "@/lib/format";

const highlights = [
  { icon: Tag, title: "Stok selalu 1", text: "Setiap barang unik. Begitu terjual, langsung hilang dari katalog." },
  { icon: Ruler, title: "Ukuran presisi", text: "Lingkar dada dan panjang diukur dalam cm, bukan sekadar S/M/L." },
  { icon: ShieldCheck, title: "Kondisi jujur", text: "Grade A/B/C plus daftar minus dan catatan penjual." },
  { icon: Wallet, title: "QRIS & transfer bank", text: "Bayar lewat QRIS atau virtual account." },
];

export function Highlights() {
  return (
    <section className="border-y bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {highlights.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="font-sans text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LatestProducts({ products }) {
  return (
    <section id="koleksi" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Baru masuk</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Koleksi terbaru</h2>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Hanya ada satu dari setiap barang. Yang kamu lihat sekarang bisa jadi milik orang lain besok.
        </p>
      </div>

      {products === null ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Katalog belum bisa dimuat. Pastikan server API berjalan, lalu muat ulang halaman.
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Semua barang sudah menemukan pemilik barunya. Nantikan koleksi berikutnya!
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

const steps = [
  { icon: Search, title: "Pilih", text: "Cek ukuran dalam cm, grade kondisi, dan foto dari 4 sudut." },
  { icon: Lock, title: "Checkout", text: "Barang langsung dikunci untukmu, jadi tidak bisa dibeli orang lain." },
  { icon: CreditCard, title: "Bayar", text: "Selesaikan pembayaran via QRIS atau VA sebelum batas waktu (60 menit)." },
  { icon: Truck, title: "Dikirim", text: "Ongkir dihitung otomatis dari berat barang dan tujuanmu." },
];

export function HowItWorks() {
  return (
    <section id="cara-kerja" className="scroll-mt-20 bg-foreground text-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Cara belanja</p>
        <h2 className="mt-2 max-w-xl text-3xl font-semibold sm:text-4xl">
          Empat langkah, tanpa rebutan.
        </h2>
        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <div className="flex items-center gap-3">
                <span className="font-heading text-4xl italic text-primary">0{i + 1}</span>
                <Icon className="size-5 opacity-70" />
              </div>
              <h3 className="mt-4 font-sans text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed opacity-70">{text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-12 max-w-2xl text-sm opacity-60">
          Kalau pembayaran tidak selesai sebelum batas waktu, pesanan otomatis dibatalkan dan barang
          kembali tersedia untuk pembeli lain.
        </p>
      </div>
    </section>
  );
}

const grades = [
  { grade: "A", text: "Nyaris tanpa cacat. Dipakai sebentar, terawat seperti baru." },
  { grade: "B", text: "Ada tanda pemakaian ringan seperti warna sedikit pudar atau pilling halus." },
  { grade: "C", text: "Ada minus yang terlihat, seperti noda atau lubang kecil. Harganya menyesuaikan." },
];

export function ConditionGrades() {
  return (
    <section id="kondisi" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Transparan</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Kondisi dijelaskan, bukan disembunyikan.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Setiap barang punya grade, daftar minus, dan catatan dari penjual. Jadi yang kamu terima
            sesuai dengan yang kamu lihat.
          </p>
        </div>
        <div className="grid gap-4">
          {grades.map(({ grade, text }) => (
            <div key={grade} className="flex items-start gap-5 rounded-2xl border bg-card p-5">
              <span className="font-heading text-4xl font-semibold text-primary">{grade}</span>
              <div>
                <h3 className="font-sans font-semibold">{GRADE_LABEL[grade]}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-heading text-base text-foreground">
          Want<span className="text-primary">To</span>Sell
        </p>
        <p>© {new Date().getFullYear()} Kelompok 20 · Marketplace thrift preloved</p>
      </div>
    </footer>
  );
}
