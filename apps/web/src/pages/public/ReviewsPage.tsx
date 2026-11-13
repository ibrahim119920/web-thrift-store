import { useEffect, useState } from "react";
import { ReviewCard } from "../../components/review/ReviewCard";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadMore } from "../../components/ui/LoadMore";
import { Skeleton } from "../../components/ui/Skeleton";
import { getLatestReviews } from "../../services/reviews";
import type { Review } from "../../types";

export function ReviewsPage() {
  const [limit, setLimit] = useState(3);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    getLatestReviews(limit)
      .then((response) => setReviews(response.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [limit]);

  return (
    <section className="bg-lime py-16 tablet:py-24">
      <div className="container-main">
        <h1 className="display-title mt-3 w-full max-w-[1280px] text-5xl leading-[0.9] tablet:text-7xl">
          Worn, loved,
          <br />
          passed on.
        </h1>
        <p className="mt-5 w-full max-w-[1280px] text-sm leading-relaxed">
          Setiap pakaian melanjutkan cerita yang berbeda. Baca pengalaman mereka yang sudah
          menemukan item pilihannya.
        </p>
        {error ? (
          <div className="mt-12">
            <ErrorState
              onRetry={() => {
                setError(false);
                setLimit(3);
              }}
            />
          </div>
        ) : (
          <>
            <div className="mt-12 grid gap-5 tablet:grid-cols-2 desktop:grid-cols-3">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-56 border-2 border-ink" />
                  ))
                : reviews.map((review) => <ReviewCard key={review._id} review={review} />)}
            </div>
            <LoadMore
              hasMore={reviews.length >= limit && reviews.length < 6}
              loading={loading}
              onClick={() => setLimit((value) => value + 3)}
            />
          </>
        )}
      </div>
    </section>
  );
}
