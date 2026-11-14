import { Filter, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CatalogFilters, defaultFilters, FilterPanel } from "../../components/product/FilterPanel";
import { ProductCard } from "../../components/product/ProductCard";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadMore } from "../../components/ui/LoadMore";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { CATEGORIES } from "../../lib/constants";
import { formatRupiah } from "../../lib/format";
import { getProducts, type ProductQuery } from "../../services/products";
import type { Product } from "../../types";

const categoryLabels: Record<string, string> = {
  semua: "Semua",
  kemeja: "Kemeja",
  kaos: "Kaos",
  jaket: "Jaket",
  celana: "Celana",
  hoodie: "Hoodie",
  blouse: "Blouse",
  sweater: "Sweater",
};

const filterLabels: Record<keyof CatalogFilters, string> = {
  brand: "Brand",
  minPrice: "Harga min",
  maxPrice: "Harga max",
  minChest: "LD min",
  maxChest: "LD max",
  minLength: "PB min",
  maxLength: "PB max",
};

const sortOptions = [
  { label: "Terbaru", value: "newest" },
  { label: "Harga terendah", value: "price_asc" },
  { label: "Harga tertinggi", value: "price_desc" },
  { label: "Lebar dada terkecil", value: "chest_asc" },
  { label: "Lebar dada terbesar", value: "chest_desc" },
];

type ShopParams = Partial<CatalogFilters> & {
  category?: string;
  sort?: string;
};

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("q") || "";
  const category = searchParams.get("category") || "semua";
  const sort = searchParams.get("sort") || "newest";
  const filtersFromUrl: CatalogFilters = {
    brand: searchParams.get("brand") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    minChest: searchParams.get("minChest") || "",
    maxChest: searchParams.get("maxChest") || "",
    minLength: searchParams.get("minLength") || "",
    maxLength: searchParams.get("maxLength") || "",
  };
  const [draftFilters, setDraftFilters] = useState(filtersFromUrl);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const appliedFilters = useMemo(() => filtersFromUrl, [searchParams.toString()]);

  useEffect(() => {
    setDraftFilters(filtersFromUrl);
  }, [searchParams.toString()]);

  useEffect(() => {
    getProducts({ limit: 100 }).then((response) =>
      setBrands([...new Set(response.data.map((product) => product.brand))].sort()),
    );
  }, []);

  const buildQuery = useCallback(
    (nextPage: number): ProductQuery => ({
      q: keyword || undefined,
      category: category === "semua" ? undefined : category,
      sort,
      brand: appliedFilters.brand || undefined,
      minPrice: toNumber(appliedFilters.minPrice),
      maxPrice: toNumber(appliedFilters.maxPrice),
      chestMin: toNumber(appliedFilters.minChest),
      chestMax: toNumber(appliedFilters.maxChest),
      lengthMin: toNumber(appliedFilters.minLength),
      lengthMax: toNumber(appliedFilters.maxLength),
      page: nextPage,
      limit: 9,
    }),
    [keyword, category, sort, appliedFilters],
  );

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      append ? setLoadingMore(true) : setLoading(true);
      setError(false);
      try {
        const response = await getProducts(buildQuery(nextPage));
        setProducts((current) => (append ? [...current, ...response.data] : response.data));
        setTotal(response.pagination?.totalData ?? response.count ?? response.data.length);
        setPage(nextPage);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildQuery],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const updateParams = (values: ShopParams) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(values).forEach(([key, value]) => {
      if (
        !value ||
        (key === "category" && value === "semua") ||
        (key === "sort" && value === "newest")
      )
        next.delete(key);
      else next.set(key, value);
    });
    next.delete("page");
    setSearchParams(next);
  };

  const applyFilters = () => {
    updateParams(draftFilters);
    setDrawerOpen(false);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    updateParams(defaultFilters);
  };

  const removeFilter = (key: keyof CatalogFilters) => {
    setDraftFilters((current) => ({ ...current, [key]: "" }));
    updateParams({ [key]: "" });
  };

  const activeFilters = (Object.entries(appliedFilters) as [keyof CatalogFilters, string][]).filter(
    ([, value]) => value,
  );

  return (
    <section className="container-main py-12 tablet:py-16">
      <div className="flex flex-col gap-5 tablet:flex-row tablet:items-end tablet:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink">
            Katalog WantToSell
          </p>
          <h1 className="display-title mt-2 text-5xl tablet:text-6xl">Shop</h1>
          <p className="mt-4 text-sm text-muted">
            {keyword ? `Hasil pencarian untuk “${keyword}”` : "Temukan pakaian preloved pilihanmu."}
          </p>
        </div>
        <div className="w-full max-w-56">
          <Select
            label="Urutkan"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value })}
            options={sortOptions}
          />
        </div>
      </div>

      <div className="-mx-4 mt-10 flex gap-6 overflow-x-auto border-b border-[#e8e9e5] px-4 tablet:mx-0 tablet:px-0">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            onClick={() => updateParams({ category: item })}
            className={`shrink-0 border-b-2 pb-3 text-sm font-semibold ${
              category === item ? "border-ink text-ink" : "border-transparent text-muted"
            }`}
          >
            {categoryLabels[item]}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between tablet:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm font-bold"
        >
          <Filter size={16} /> Filter
        </button>
        <span className="text-xs text-muted">{total} barang</span>
      </div>

      <div className="mt-7 grid items-start gap-8 tablet:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border border-[#e8e9e5] tablet:block">
          <h2 className="border-b border-[#e8e9e5] px-4 py-4 text-sm font-black">FILTER</h2>
          <div className="p-4">
            <FilterPanel
              value={draftFilters}
              brands={brands}
              onChange={setDraftFilters}
              onApply={applyFilters}
              onReset={resetFilters}
            />
          </div>
        </aside>

        <div className="min-w-0">
          {activeFilters.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {activeFilters.map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => removeFilter(key)}
                  className="flex items-center gap-2 rounded-full bg-[#eeeeea] px-3 py-2 text-xs font-semibold"
                >
                  {filterLabels[key]}: {key.includes("Price") ? formatRupiah(Number(value)) : value}
                  <X size={13} />
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-4 desktop:grid-cols-3 desktop:gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index}>
                  <Skeleton className="aspect-[4/5] w-full" />
                  <Skeleton className="mx-4 mt-4 h-3 w-2/3" />
                  <Skeleton className="mx-4 mt-2 h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState onRetry={() => void load(1)} />
          ) : products.length === 0 ? (
            <EmptyState
              title="Belum ada barang yang cocok dengan filter kamu"
              description="Coba ubah atau kosongkan filter untuk melihat koleksi lainnya."
              action={<Button onClick={resetFilters}>Reset filter</Button>}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 desktop:grid-cols-3 desktop:gap-5">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
              <p className="mt-10 text-center text-xs text-muted">
                Menampilkan {products.length} dari {total} barang
              </p>
              <LoadMore
                hasMore={products.length < total}
                loading={loadingMore}
                onClick={() => void load(page + 1, true)}
              />
            </>
          )}
        </div>
      </div>

      <Drawer open={drawerOpen} title="Filter" onClose={() => setDrawerOpen(false)}>
        <FilterPanel
          value={draftFilters}
          brands={brands}
          onChange={setDraftFilters}
          onApply={applyFilters}
          onReset={resetFilters}
        />
      </Drawer>
    </section>
  );
}

function toNumber(value: string) {
  return value === "" ? undefined : Number(value);
}
