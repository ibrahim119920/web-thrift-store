import { ArrowUpRight, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRupiah, formatSize } from "../../lib/format";
import type { Product } from "../../types";
import { Badge } from "../ui/Badge";

export function ProductCard({
  product,
  removable,
  onRemove,
  favorite,
  onFavoriteToggle,
  favoriteLoading,
}: {
  product: Product;
  removable?: boolean;
  onRemove?: () => void;
  favorite?: boolean;
  onFavoriteToggle?: () => void;
  favoriteLoading?: boolean;
}) {
  const showFavorite = removable || favorite !== undefined;
  const isFavorite = favorite ?? removable ?? false;
  const toggleFavorite = onFavoriteToggle || onRemove;

  return (
    <article className="group relative bg-white">
      <Link
        to={`/products/${product._id}`}
        className="absolute inset-0 z-10"
        aria-label={`Lihat ${product.name}`}
      />
      <div className="overflow-hidden bg-[#f1f1ed]">
        <img
          src={product.images[0]}
          alt={product.name}
          className="aspect-[4/5] w-full object-contain transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      {product.status !== "available" && (
        <div className="absolute left-3 top-3">
          <Badge status={product.status} />
        </div>
      )}
      {showFavorite && (
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={favoriteLoading}
          className={`absolute right-3 top-3 z-20 grid size-10 place-items-center rounded-full transition disabled:opacity-50 ${
            isFavorite
              ? "bg-pink text-white"
              : "border border-ink bg-white text-ink hover:bg-pink hover:text-white"
          }`}
          aria-label={isFavorite ? "Hapus dari favorit" : "Tambahkan ke favorit"}
          aria-pressed={isFavorite}
        >
          <Heart size={18} fill="currentColor" />
        </button>
      )}
      <div className="px-4 pb-4 pt-4">
        <p className="text-xs text-muted">
          {product.brand} | {formatSize(product.size.chest)}
        </p>
        <h3 className="mt-1 font-bold">{product.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <strong className="text-sm">{formatRupiah(product.price)}</strong>
          <ArrowUpRight size={18} />
        </div>
      </div>
    </article>
  );
}
