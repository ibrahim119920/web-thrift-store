export type Role = "buyer" | "admin";
export type ProductStatus = "available" | "reserved" | "sold";
export type OrderStatus =
  | "waiting_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";
export type PaymentStatus = "pending" | "success" | "failed" | "expired";

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  size: { label: string; chest: number; length: number };
  condition: {
    grade: "A" | "B" | "C";
    description: string;
    minusTags: string[];
    sellerNote: string;
  };
  price: number;
  images: string[];
  weight: number;
  status: ProductStatus;
  reviewSummary?: { averageRating: number | null; totalReviews: number };
  createdAt: string;
}

export interface Review {
  _id: string;
  rating: number;
  comment: string;
  user?: { _id?: string; name: string; avatar?: string };
  product?: { _id: string; name: string; category: string; images?: string[] };
  createdAt: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId?: string | { _id: string; name: string; email: string; phone?: string };
  items: { productId: string; name: string; price: number; qty: number }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  shippingAddressId: string;
  shipping: { courier: string; service: string; trackingNumber?: string };
  status: OrderStatus;
  expiresAt: string;
}

export interface ShippingAddress {
  _id: string;
  label?: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  postalCode: string;
}

export interface PaymentRecord {
  _id: string;
  orderId: string;
  /** Dinormalisasi oleh service dari `paymentMethod` milik backend. */
  method: "bank_transfer" | "qris" | "snap" | "ewallet" | "credit_card" | "cstore" | "other";
  paymentMethod?: string;
  status: PaymentStatus;
  amount: number;
  createdAt: string;
  snapToken?: string;
  redirectUrl?: string;
  transactionStatus?: string;
  paymentData: {
    bankName?: string;
    virtualAccount?: string;
    bank?: string;
    vaNumber?: string;
    qrString?: string;
    qrUrl?: string;
    billKey?: string;
    billerCode?: string;
    paymentCode?: string;
    store?: string;
  };
}

export interface PaymentConfig {
  mode: "qris-core" | "snap";
  isProduction: boolean;
  expiryMinutes: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  count?: number;
  pagination?: { totalData: number; totalPages: number; currentPage: number; limit: number };
}

export interface ApiErrorBody {
  success?: false;
  message?: string;
  errors?: { field: string; message: string }[];
}
