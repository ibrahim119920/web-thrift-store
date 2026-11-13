import { Star } from "lucide-react";

export function RatingStars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-1" aria-label={`${value} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= value ? "#FFB01D" : "transparent"}
          color="#FFB01D"
        />
      ))}
    </div>
  );
}
