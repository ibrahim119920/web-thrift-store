import { useLocation } from "react-router-dom";
import { STORE_LOCATION } from "../../lib/constants";

const content: Record<
  string,
  { title: string; intro: string; sections: { title: string; body: string }[] }
> = {
  "/about": {
    title: "OLD PIECES, NEW STORIES.",
    intro:
      "WantToSell adalah etalase thrift untuk pakaian preloved pilihan yang layak menjalani cerita berikutnya.",
    sections: [
      {
        title: "Dipilih satu per satu",
        body: "Setiap item kami kurasi berdasarkan kondisi, karakter, dan kelayakan pakainya. Stok selalu satu karena setiap pakaian memang unik.",
      },
      {
        title: "Kondisi yang jujur",
        body: "Ukuran, kondisi, dan minus pakaian dijelaskan apa adanya agar kamu bisa berbelanja dengan lebih yakin.",
      },
    ],
  },
  "/how-to-buy": {
    title: "HOW TO BUY",
    intro:
      "Menemukan dan membawa pulang pakaian preloved pilihan hanya membutuhkan beberapa langkah.",
    sections: [
      {
        title: "Pilih barang",
        body: "Telusuri katalog, gunakan filter ukuran, brand, dan harga, lalu buka detail produk yang kamu sukai.",
      },
      {
        title: "2. Checkout",
        body: "Masukkan barang ke keranjang, pilih alamat dan layanan pengiriman, lalu konfirmasi bahwa kamu memahami kondisi preloved.",
      },
      {
        title: "3. Selesaikan pembayaran",
        body: "Bayar menggunakan QRIS atau transfer bank sebelum batas waktu berakhir.",
      },
    ],
  },
  "/size-guide": {
    title: "SIZE GUIDE",
    intro:
      "Ukuran pakaian preloved dapat berbeda dari labelnya. Gunakan ukuran aktual sebagai acuan utama.",
    sections: [
      {
        title: "LD — Lebar Dada",
        body: "Diukur mendatar dari ketiak kiri ke ketiak kanan. Bandingkan dengan pakaian milikmu yang paling nyaman.",
      },
      {
        title: "PB — Panjang Badan",
        body: "Diukur dari titik bahu tertinggi hingga ujung bawah pakaian.",
      },
    ],
  },
  "/faq": {
    title: "FREQUENTLY ASKED QUESTIONS",
    intro: "Jawaban singkat untuk pertanyaan yang paling sering ditanyakan.",
    sections: [
      {
        title: "Apakah barangnya baru?",
        body: "Tidak. Semua barang adalah pakaian preloved yang sudah dikurasi dan dijelaskan kondisinya.",
      },
      {
        title: "Apakah ukuran bisa dipilih?",
        body: "Tidak. Setiap listing adalah satu barang unik. Periksa LD dan PB sebelum membeli.",
      },
      {
        title: "Bisakah barang dikembalikan?",
        body: "Hubungi kami jika barang yang diterima berbeda secara material dari deskripsi.",
      },
    ],
  },
  "/contact": {
    title: "HUBUNGI KAMI",
    intro: "Punya pertanyaan tentang barang atau pesanan? Tim kami siap membantu.",
    sections: [
      { title: "Email", body: "halo@wanttosell.id" },
      { title: "Telepon", body: "+62 812 2026 1126" },
      { title: "Lokasi", body: STORE_LOCATION },
      { title: "Jam layanan", body: "Senin–Jumat, pukul 09.00–17.00 WIB." },
    ],
  },
  "/privacy": {
    title: "PRIVACY",
    intro:
      "Kami menghargai privasi dan hanya menggunakan data yang diperlukan untuk memproses akun dan pesananmu.",
    sections: [
      {
        title: "Data yang disimpan",
        body: "Informasi akun, alamat pengiriman, dan riwayat transaksi digunakan untuk menjalankan layanan WantToSell.",
      },
      {
        title: "Keamanan",
        body: "Kami menerapkan langkah yang wajar untuk melindungi data dari akses yang tidak berwenang.",
      },
    ],
  },
  "/terms": {
    title: "TERMS",
    intro: "Dengan menggunakan WantToSell, kamu menyetujui ketentuan layanan berikut.",
    sections: [
      {
        title: "Barang preloved",
        body: "Kondisi setiap barang dapat berbeda. Foto, ukuran, kondisi, dan catatan penjual menjadi bagian dari deskripsi produk.",
      },
      {
        title: "Stok tunggal",
        body: "Barang dapat menjadi tidak tersedia saat sedang diproses oleh pembeli lain.",
      },
    ],
  },
};

export function StaticPage() {
  const { pathname } = useLocation();
  const page = content[pathname] || content["/about"];
  return (
    <article className="py-16 tablet:py-24">
      <header className="container-main">
        <h1 className="display-title max-w-4xl text-5xl leading-[0.9] tablet:text-7xl">
          {page.title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">{page.intro}</p>
      </header>
      <div className="container-main mt-14 max-w-[1120px]">
        {page.sections.map((section, index) => (
          <section
            key={section.title}
            className="flex flex-col border-t border-[#d9d9d3] py-8 tablet:flex-row tablet:gap-8 tablet:py-10"
          >
            <span className="shrink-0 text-xs font-bold text-muted tablet:w-20">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-3 shrink-0 text-xl font-extrabold tablet:mt-0 tablet:w-[280px]">
              {section.title}
            </h2>
            <p className="mt-4 max-w-xl flex-1 text-sm leading-7 text-muted tablet:mt-0">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
