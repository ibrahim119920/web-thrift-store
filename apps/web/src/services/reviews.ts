import { USE_MOCK } from "../lib/constants";
import type { Review } from "../types";
import { apiRequest, mockResponse } from "./api";
import { mockReviews } from "./mock/data";

/** BE mem-populate `userId`/`productId`; FE memakai `user`/`product`. */
export type RawReview = Omit<Review, "user" | "product"> & {
  userId?: Review["user"] | string;
  productId?: Review["product"] | string;
  user?: Review["user"];
  product?: Review["product"];
};

export const normalizeReview = ({ userId, productId, ...review }: RawReview): Review => ({
  ...review,
  user: review.user ?? (typeof userId === "object" ? userId : undefined),
  product: review.product ?? (typeof productId === "object" ? productId : undefined),
});

export const getLatestReviews = (limit = 3) =>
  USE_MOCK
    ? mockResponse(mockReviews.slice(0, limit))
    : apiRequest<RawReview[]>(`/reviews?limit=${limit}&sort=newest`).then((response) => ({
        ...response,
        data: response.data.map(normalizeReview),
      }));
export const createReview = (
  productId: string,
  body: { orderId: string; rating: number; comment: string },
) =>
  apiRequest<Review>(`/products/${productId}/reviews`, {
    method: "POST",
    body: JSON.stringify(body),
  });
