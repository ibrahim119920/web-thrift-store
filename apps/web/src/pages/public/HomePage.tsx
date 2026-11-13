import { ArrowDownRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "../../components/product/ProductCard";
import { ReviewCard } from "../../components/review/ReviewCard";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { getProducts } from "../../services/products";
import { getLatestReviews } from "../../services/reviews";
import type { Product, Review } from "../../types";

export function HomePage() {
  const catalogRef = useRef<HTMLElement>(null);
  const [latest, setLatest] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [latestResponse, featuredResponse, reviewResponse] = await Promise.all([
        getProducts({ sort: "newest", limit: 3 }),
        getProducts({ sort: "newest", limit: 6 }),
        getLatestReviews(3),
      ]);
      setLatest(latestResponse.data);
      setFeatured(featuredResponse.data);
      setReviews(reviewResponse.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <section className="container-main grid min-h-[680px] items-center gap-6 py-12 desktop:grid-cols-[1.08fr_0.92fr] desktop:py-16">
        <div className="relative z-10 py-5">
          <h1 className="display-title text-[clamp(3rem,7vw,5.5rem)] leading-[0.9]">
            OLD PIECES,
            <span className="block font-display font-normal italic tracking-[-0.06em] text-pink">
              NEW STORIES.
            </span>
          </h1>
          <p className="mt-7 max-w-[530px] text-sm leading-relaxed tablet:text-[15px]">
            Temukan pakaian pilihan yang siap menjalani cerita berikutnya bersamamu. Satu barang,
            satu pemilik baru.
          </p>
          <Button
            className="mt-7"
            onClick={() => catalogRef.current?.scrollIntoView({ behavior: "smooth" })}
          >
            SHOP THE DROP <ArrowDownRight size={17} />
          </Button>
        </div>
        <div className="relative min-h-[420px] desktop:min-h-[680px]">
          <img
            src="/assets/86b4b.png"
            alt="Koleksi pakaian preloved terkurasi"
            className="absolute inset-0 h-full w-full object-contain object-bottom"
          />
          <div className="absolute right-3 top-4 grid size-[82px] rotate-6 place-items-center rounded-full border-2 border-dashed border-white bg-pink text-center font-['Space_Mono:Bold'] text-sm leading-tight text-white tablet:right-8 tablet:top-10">
            <span>
              100%
              <br />
              CURATED
            </span>
          </div>
        </div>
      </section>

      <section id="latest-drop" className="scroll-mt-28 bg-lime py-20">
        <div className="container-main grid items-center gap-8 desktop:grid-cols-[260px_1fr]">
          <h2 className="display-title text-5xl leading-[0.88] tablet:text-7xl">
            OUR
            <span className="block text-pink">
              LATEST
              <br />
              DROP
            </span>
          </h2>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 tablet:mx-0 tablet:grid tablet:grid-cols-3 tablet:overflow-visible tablet:px-0 tablet:pb-0">
            {latest.map((product) => (
              <div
                key={product._id}
                className="w-[calc((100vw-44px)/2)] min-w-[160px] max-w-[230px] shrink-0 snap-start tablet:w-auto tablet:min-w-0 tablet:max-w-none"
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={catalogRef} className="scroll-mt-28 py-16 desktop:py-20">
        <div className="container-main">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink">
                Pilihan terbaru
              </p>
              <h2 className="display-title mt-2 text-4xl tablet:text-5xl">Shop the collection</h2>
            </div>
            <Link
              to="/shop"
              className="hidden border-b border-ink pb-1 text-xs font-bold tablet:block"
            >
              LIHAT SEMUA
            </Link>
          </div>

          {loading ? (
            <ProductSkeletons />
          ) : error ? (
            <div className="mt-8">
              <ErrorState onRetry={() => void load()} />
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-4 tablet:grid-cols-3 tablet:gap-5">
                {featured.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
              <div className="mt-10 text-center">
                <Link
                  to="/shop"
                  className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-ink px-6 text-sm font-bold text-white transition hover:bg-pink"
                >
                  Muat lebih banyak
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section id="reviews" className="bg-lime py-16 desktop:py-20">
        <div className="container-main">
          <div className="flex items-end justify-between gap-5">
            <div>
              <h2 className="display-title text-4xl leading-[0.92] tablet:text-5xl">
                Worn, loved,
                <br />
                passed on.
              </h2>
              <p className="mt-3 text-sm">
                Cerita nyata dari mereka yang sudah memberi pakaian lama sebuah rumah baru.
              </p>
            </div>
            <Link
              to="/reviews"
              className="hidden border-b border-ink pb-1 text-xs font-bold tracking-wider tablet:block"
            >
              SEE ALL REVIEWS
            </Link>
          </div>
          <div className="-mx-4 mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-3 tablet:mx-0 tablet:grid tablet:grid-cols-3 tablet:px-0 tablet:pb-0">
            {reviews.map((review) => (
              <div
                key={review._id}
                className="w-[86vw] max-w-[390px] shrink-0 snap-start tablet:w-auto"
              >
                <ReviewCard review={review} />
              </div>
            ))}
          </div>
          <Link
            to="/reviews"
            className="mt-7 inline-block border-b border-ink pb-1 text-xs font-bold tracking-wider tablet:hidden"
          >
            SEE ALL REVIEWS
          </Link>
        </div>
      </section>
    </>
  );
}

function ProductSkeletons() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 tablet:grid-cols-3 tablet:gap-5">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton className="mx-4 mt-4 h-3 w-2/3" />
          <Skeleton className="mx-4 mt-2 h-4 w-3/4" />
          <Skeleton className="mx-4 mb-4 mt-3 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
