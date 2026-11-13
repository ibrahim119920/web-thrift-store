import { Construction } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const labels: Record<string, string> = {
  "/": "Home",
  "/products": "Katalog",
  "/reviews": "Ulasan",
  "/login": "Log In",
  "/register": "Sign Up",
  "/about": "About",
  "/how-to-buy": "Cara Membeli",
  "/size-guide": "Panduan Ukuran",
  "/faq": "FAQ",
  "/contact": "Hubungi Kami",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/cart": "Keranjang",
  "/favorites": "Favorit",
  "/checkout": "Checkout",
  "/orders": "Pesanan Saya",
  "/profile": "Profil Saya",
  "/admin/products": "Produk Admin",
  "/admin/products/new": "Tambah Produk",
  "/admin/orders": "Pesanan Admin",
};

export function PlaceholderPage({ title }: { title?: string }) {
  const location = useLocation();
  const dynamicTitle = location.pathname.includes("/pay")
    ? "Pembayaran"
    : location.pathname.includes("/edit")
      ? "Edit Produk"
      : location.pathname.match(/^\/products\/.+/)
        ? "Detail Produk"
        : location.pathname.match(/^\/orders\/.+/)
          ? "Detail Pesanan"
          : labels[location.pathname];
  return (
    <section className="container-main grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-lime">
          <Construction size={24} />
        </span>
        <p className="mt-6 text-xs font-bold tracking-[0.18em] text-pink">FONDASI SIAP</p>
        <h1 className="display-title mt-2 text-4xl tablet:text-6xl">
          {title || dynamicTitle || "Halaman"}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
          Rute, layout, guard, state, dan service untuk halaman ini sudah terhubung. Konten lengkap
          akan dibuat pada tahap berikutnya.
        </p>
        {location.pathname !== "/" && (
          <Link to="/" className="mt-7 inline-block border-b-2 border-ink pb-1 text-sm font-bold">
            Kembali ke Home
          </Link>
        )}
      </div>
    </section>
  );
}
