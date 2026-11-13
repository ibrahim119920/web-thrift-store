import type { Review } from "../../types";
import { RatingStars } from "../ui/RatingStars";

export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="flex min-h-56 flex-col justify-between border-2 border-ink bg-canvas p-7">
      <div>
        <RatingStars value={review.rating} />
        <blockquote className="mt-7 text-base leading-relaxed">“{review.comment}”</blockquote>
      </div>
      <div className="mt-8 flex items-end justify-between gap-4 text-xs">
        <strong>{review.user.name}</strong>
        <span className="text-right text-muted">{review.product.name}</span>
      </div>
    </article>
  );
}
