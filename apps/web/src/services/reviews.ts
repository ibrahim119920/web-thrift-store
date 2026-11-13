import { USE_MOCK } from "../lib/constants";
import type { Review } from "../types";
import { apiRequest, mockResponse } from "./api";
import { mockReviews } from "./mock/data";

export const getLatestReviews = (limit = 3) =>
  USE_MOCK
    ? mockResponse(mockReviews.slice(0, limit))
    : apiRequest<Review[]>(`/reviews?limit=${limit}&sort=newest`);
export const createReview = (
  productId: string,
  body: { orderId: string; rating: number; comment: string },
) =>
  apiRequest<Review>(`/products/${productId}/reviews`, {
    method: "POST",
    body: JSON.stringify(body),
  });
