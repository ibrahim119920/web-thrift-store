import { USE_MOCK } from "../lib/constants";
import type { Product, Review } from "../types";
import { apiRequest, mockResponse } from "./api";
import { mockProducts, mockReviews } from "./mock/data";

const PRODUCTS_KEY = "wanttosell_products";

const readMockProducts = () => {
  try {
    return JSON.parse(
      localStorage.getItem(PRODUCTS_KEY) || JSON.stringify(mockProducts),
    ) as Product[];
  } catch {
    return [...mockProducts];
  }
};

const writeMockProducts = (products: Product[]) =>
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));

export interface ProductQuery {
  category?: string;
  q?: string;
  keyword?: string;
  sort?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  chestMin?: number;
  chestMax?: number;
  lengthMin?: number;
  lengthMax?: number;
  page?: number;
  limit?: number;
  status?: string;
}

export async function getProducts(query: ProductQuery = {}) {
  if (!USE_MOCK)
    return apiRequest<Product[]>(
      `/products?${new URLSearchParams(
        Object.entries(query)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      )}`,
    );
  let data = readMockProducts();
  const keyword = query.keyword || query.q;
  if (!query.status) data = data.filter((product) => product.status === "available");
  if (query.category && query.category !== "semua")
    data = data.filter((product) => product.category === query.category);
  if (keyword)
    data = data.filter((product) =>
      `${product.name} ${product.brand} ${product.category}`
        .toLowerCase()
        .includes(keyword.toLowerCase()),
    );
  if (query.brand)
    data = data.filter((product) =>
      product.brand.toLowerCase().includes(query.brand!.toLowerCase()),
    );
  if (query.minPrice !== undefined)
    data = data.filter((product) => product.price >= query.minPrice!);
  if (query.maxPrice !== undefined)
    data = data.filter((product) => product.price <= query.maxPrice!);
  if (query.chestMin !== undefined)
    data = data.filter((product) => product.size.chest >= query.chestMin!);
  if (query.chestMax !== undefined)
    data = data.filter((product) => product.size.chest <= query.chestMax!);
  if (query.lengthMin !== undefined)
    data = data.filter((product) => product.size.length >= query.lengthMin!);
  if (query.lengthMax !== undefined)
    data = data.filter((product) => product.size.length <= query.lengthMax!);
  data.sort((a, b) =>
    query.sort === "price_asc"
      ? a.price - b.price
      : query.sort === "price_desc"
        ? b.price - a.price
        : query.sort === "chest_asc"
          ? a.size.chest - b.size.chest
          : query.sort === "chest_desc"
            ? b.size.chest - a.size.chest
            : +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  const limit = query.limit || 9;
  const page = query.page || 1;
  const start = (page - 1) * limit;
  return {
    success: true,
    message: "Berhasil",
    data: data.slice(start, start + limit),
    count: data.length,
    pagination: {
      totalData: data.length,
      totalPages: Math.ceil(data.length / limit),
      currentPage: page,
      limit,
    },
  };
}

export const getProduct = (id: string) =>
  USE_MOCK
    ? mockResponse(readMockProducts().find((item) => item._id === id)!)
    : apiRequest<Product>(`/products/${id}`);
export const getProductReviews = (id: string) =>
  USE_MOCK
    ? mockResponse(mockReviews.filter((review) => review.product._id === id))
    : apiRequest<Review[]>(`/products/${id}/reviews`);
export const getAdminProducts = () =>
  USE_MOCK ? mockResponse(readMockProducts()) : apiRequest<Product[]>("/admin/products?limit=100");

export const createProduct = (body: Partial<Product>) => {
  if (USE_MOCK) {
    const product = {
      ...body,
      _id: `product-${Date.now()}`,
      createdAt: new Date().toISOString(),
    } as Product;
    writeMockProducts([product, ...readMockProducts()]);
    return mockResponse(product, "Produk berhasil ditambahkan");
  }
  return apiRequest<Product>("/products", { method: "POST", body: JSON.stringify(body) });
};

export const updateProduct = (id: string, body: Partial<Product>) => {
  if (USE_MOCK) {
    const products = readMockProducts().map((product) =>
      product._id === id ? { ...product, ...body } : product,
    );
    writeMockProducts(products);
    return mockResponse(
      products.find((product) => product._id === id)!,
      "Produk berhasil diubah",
    );
  }
  return apiRequest<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) });
};

export const deleteProduct = (id: string) => {
  if (USE_MOCK) {
    writeMockProducts(readMockProducts().filter((product) => product._id !== id));
    return mockResponse<null>(null, "Produk berhasil dihapus");
  }
  return apiRequest<null>(`/products/${id}`, { method: "DELETE" });
};
