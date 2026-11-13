import { Heart, Search, ShoppingBag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { Logo } from "./Logo";

export function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(
    location.pathname === "/shop" ? searchParams.get("q") || "" : "",
  );
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === "/shop") setQuery(searchParams.get("q") || "");
  }, [location.pathname, searchParams.toString()]);

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/shop?q=${encodeURIComponent(value)}` : "/shop");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#e7e7e2] bg-white/95 backdrop-blur">
      <div className="container-header grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3 py-4 tablet:gap-x-8">
        <div className="shrink-0 tablet:[&_a]:text-xl">
          <Logo />
        </div>

        <form
          onSubmit={search}
          className="order-3 col-span-3 flex min-h-12 min-w-0 items-center gap-3 rounded-full bg-[#f1f1f1] px-5 tablet:order-none tablet:col-span-1 tablet:min-h-14"
        >
          <Search size={21} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, brands..."
            aria-label="Cari produk dan brand"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none tablet:text-base"
          />
        </form>

        <div className="flex items-center justify-end gap-0.5 tablet:gap-2">
          {user?.role !== "admin" && (
            <>
              <Link
                to="/favorites"
                className="grid size-10 place-items-center rounded-full transition hover:bg-lime tablet:size-11"
                aria-label="Favorit"
              >
                <Heart size={21} />
              </Link>
              <Link
                to="/cart"
                className="relative grid size-10 place-items-center rounded-full transition hover:bg-lime tablet:size-11"
                aria-label={`Keranjang, ${count} barang`}
              >
                <ShoppingBag size={21} />
                {count > 0 && (
                  <span className="absolute right-0 top-0 grid size-[18px] place-items-center rounded-full border-2 border-white bg-pink text-[9px] font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
            </>
          )}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className="grid size-10 place-items-center rounded-full transition hover:bg-lime tablet:size-11"
                aria-label="Menu profil"
              >
                <UserRound size={22} />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-12 w-48 border border-ink bg-white p-2 text-sm shadow-[4px_4px_0_#121212]">
                  {user.role === "admin" ? (
                    <Link className="block px-3 py-2 font-bold hover:bg-lime" to="/admin">
                      Dashboard Admin
                    </Link>
                  ) : (
                    <>
                      <Link className="block px-3 py-2 hover:bg-lime" to="/profile">
                        Profil Saya
                      </Link>
                      <Link className="block px-3 py-2 hover:bg-lime" to="/orders">
                        Pesanan Saya
                      </Link>
                      <Link className="block px-3 py-2 hover:bg-lime" to="/favorites">
                        Favorit
                      </Link>
                    </>
                  )}
                  <button className="w-full px-3 py-2 text-left hover:bg-lime" onClick={logout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="grid size-10 place-items-center rounded-full transition hover:bg-lime tablet:size-11"
              aria-label="Log In"
            >
              <UserRound size={22} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
