import { ADDRESSES_KEY, FAVORITES_KEY, ORDERS_KEY, PAYMENTS_KEY, USE_MOCK } from "../lib/constants";
import type { Order, PaymentRecord, Product, ShippingAddress } from "../types";
import { apiRequest, mockResponse } from "./api";
import { mockOrders, mockProducts } from "./mock/data";

const getMockFavoriteIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
};

const readStorage = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const writeStorage = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));

// Backend menyimpan `paymentMethod` + `paymentData.{bank,vaNumber}`; UI memakai
// `method` + `paymentData.{bankName,virtualAccount}`. Samakan di satu tempat.
const normalizePayment = (payment: PaymentRecord): PaymentRecord => ({
  ...payment,
  method: (payment.paymentMethod as PaymentRecord["method"]) || payment.method,
  paymentData: {
    ...payment.paymentData,
    bankName: payment.paymentData?.bankName || payment.paymentData?.bank?.toUpperCase(),
    virtualAccount: payment.paymentData?.virtualAccount || payment.paymentData?.vaNumber,
  },
});

const defaultAddresses: ShippingAddress[] = [
  {
    _id: "address-1",
    label: "Rumah",
    recipientName: "Pembeli Demo",
    phone: "081234567890",
    province: "DI Yogyakarta",
    city: "Sleman",
    district: "Depok",
    address: "Jl. Kaliurang KM 5, Sleman",
    postalCode: "55281",
  },
  {
    _id: "address-2",
    label: "Kos",
    recipientName: "Pembeli Demo",
    phone: "081234567890",
    province: "DI Yogyakarta",
    city: "Sleman",
    district: "Depok",
    address: "Jl. Seturan Raya No. 4",
    postalCode: "55281",
  },
  {
    _id: "address-3",
    label: "Kantor",
    recipientName: "Pembeli Demo",
    phone: "081234567890",
    province: "DI Yogyakarta",
    city: "Yogyakarta",
    district: "Gondokusuman",
    address: "Jl. Colombo No. 12",
    postalCode: "55223",
  },
];

const getMockShippingCost = (courier?: string, service?: string) => {
  if (service === "yes" || service === "ons" || service === "express") return 30000;
  if (courier === "pos") return 20000;
  if (courier === "tiki") return 19000;
  return 18000;
};

export const favoritesService = {
  list: () =>
    USE_MOCK
      ? mockResponse(mockProducts.filter((product) => getMockFavoriteIds().includes(product._id)))
      : apiRequest<Product[]>("/favorites"),
  add: (productId: string) => {
    if (USE_MOCK) {
      const ids = getMockFavoriteIds();
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...new Set([...ids, productId])]));
      return mockResponse<null>(null);
    }
    return apiRequest<null>("/favorites", {
      method: "POST",
      body: JSON.stringify({ productId }),
    });
  },
  remove: (productId: string) => {
    if (USE_MOCK) {
      localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(getMockFavoriteIds().filter((id) => id !== productId)),
      );
      return mockResponse<null>(null);
    }
    return apiRequest<null>(`/favorites/${productId}`, { method: "DELETE" });
  },
};

export const addressesService = {
  list: () =>
    USE_MOCK
      ? mockResponse(readStorage(ADDRESSES_KEY, defaultAddresses))
      : apiRequest<ShippingAddress[]>("/shipping-addresses"),
  create: (body: Omit<ShippingAddress, "_id">) => {
    if (USE_MOCK) {
      const addresses = readStorage(ADDRESSES_KEY, defaultAddresses);
      const address = { ...body, _id: `address-${Date.now()}` };
      writeStorage(ADDRESSES_KEY, [...addresses, address]);
      return mockResponse(address);
    }
    const { label: _label, ...apiBody } = body;
    return apiRequest<ShippingAddress>("/shipping-addresses", {
      method: "POST",
      body: JSON.stringify(apiBody),
    });
  },
  remove: (id: string) => {
    if (USE_MOCK) {
      writeStorage(
        ADDRESSES_KEY,
        readStorage(ADDRESSES_KEY, defaultAddresses).filter((item) => item._id !== id),
      );
      return mockResponse<null>(null);
    }
    return apiRequest<null>(`/shipping-addresses/${id}`, { method: "DELETE" });
  },
};
export const ordersService = {
  list: () =>
    USE_MOCK
      ? mockResponse(readStorage<Order[]>(ORDERS_KEY, mockOrders))
      : apiRequest<Order[]>("/orders"),
  get: (id: string) =>
    USE_MOCK
      ? mockResponse(
          readStorage<Order[]>(ORDERS_KEY, mockOrders).find((order) => order._id === id)!,
        )
      : apiRequest<Order>(`/orders/${id}`),
  create: (body: {
    productIds: string[];
    shippingAddressId: string;
    courier: string;
    service: string;
    confirmUsedItem: boolean;
  }) => {
    if (USE_MOCK) {
      const products = mockProducts.filter((product) => body.productIds.includes(product._id));
      const subtotal = products.reduce((total, product) => total + product.price, 0);
      const shippingCost = getMockShippingCost(body.courier, body.service);
      const now = new Date();
      const order: Order = {
        _id: `order-${Date.now()}`,
        orderNumber: `WTS-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-6)}`,
        items: products.map((product) => ({
          productId: product._id,
          name: product.name,
          price: product.price,
          qty: 1,
        })),
        subtotal,
        shippingCost,
        total: subtotal + shippingCost,
        shippingAddressId: body.shippingAddressId,
        shipping: { courier: body.courier, service: body.service },
        status: "waiting_payment",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      writeStorage(ORDERS_KEY, [order, ...readStorage<Order[]>(ORDERS_KEY, mockOrders)]);
      return mockResponse(order, "Pesanan berhasil dibuat");
    }
    return apiRequest<Order>("/orders", { method: "POST", body: JSON.stringify(body) });
  },
  cancel: (id: string) => {
    if (USE_MOCK) {
      const orders = readStorage<Order[]>(ORDERS_KEY, mockOrders);
      const updated = orders.map((order) =>
        order._id === id ? { ...order, status: "cancelled" as const } : order,
      );
      writeStorage(ORDERS_KEY, updated);
      return mockResponse(updated.find((order) => order._id === id)!);
    }
    return apiRequest<Order>(`/orders/${id}/cancel`, { method: "POST" });
  },
  estimate: (body: {
    productIds: string[];
    shippingAddressId?: string;
    courier?: string;
    service?: string;
  }) => {
    if (USE_MOCK) {
      const weightGram = mockProducts
        .filter((product) => body.productIds.includes(product._id))
        .reduce((total, product) => total + product.weight, 0);
      return mockResponse({
        weightGram,
        shippingCost: getMockShippingCost(body.courier, body.service),
      });
    }
    return apiRequest<{ weightGram: number; shippingCost: number }>("/shipping/estimate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  payments: (id: string) => {
    if (USE_MOCK) {
      const records = readStorage<PaymentRecord[]>(PAYMENTS_KEY, []);
      const updated = records.map((payment) =>
        payment.orderId === id &&
        payment.status === "pending" &&
        Date.now() - new Date(payment.createdAt).getTime() > 12000
          ? { ...payment, status: "success" as const }
          : payment,
      );
      if (updated.some((payment) => payment.orderId === id && payment.status === "success")) {
        writeStorage(
          ORDERS_KEY,
          readStorage<Order[]>(ORDERS_KEY, mockOrders).map((order) =>
            order._id === id ? { ...order, status: "paid" as const } : order,
          ),
        );
      }
      writeStorage(PAYMENTS_KEY, updated);
      return mockResponse(updated.filter((payment) => payment.orderId === id));
    }
    return apiRequest<PaymentRecord[]>(`/orders/${id}/payments`).then((response) => ({
      ...response,
      data: response.data.map(normalizePayment),
    }));
  },
  createSnap: (id: string) => {
    if (USE_MOCK) return mockResponse<PaymentRecord | null>(null, "Mode mock tidak memakai Midtrans.");
    return apiRequest<PaymentRecord>(`/orders/${id}/payments/snap`, { method: "POST" }).then(
      (response) => ({ ...response, data: normalizePayment(response.data) }),
    );
  },
  createQrisCore: (id: string) => {
    if (USE_MOCK) return mockResponse<PaymentRecord | null>(null, "Mode mock tidak memakai Midtrans.");
    return apiRequest<PaymentRecord>(`/orders/${id}/payments/qris-core`, { method: "POST" }).then(
      (response) => ({ ...response, data: normalizePayment(response.data) }),
    );
  },
  payQris: (id: string) => {
    if (USE_MOCK) {
      const records = readStorage<PaymentRecord[]>(PAYMENTS_KEY, []);
      const existing = records.find((payment) => payment.orderId === id);
      if (existing) return mockResponse(existing);
      const order = readStorage<Order[]>(ORDERS_KEY, mockOrders).find((item) => item._id === id)!;
      const payment: PaymentRecord = {
        _id: `payment-${Date.now()}`,
        orderId: id,
        method: "qris",
        status: "pending",
        amount: order.total,
        createdAt: new Date().toISOString(),
        paymentData: {
          qrString: `WANTTOSELL|${order.orderNumber}|${order.total}|${id}`,
        },
      };
      writeStorage(PAYMENTS_KEY, [...records, payment]);
      return mockResponse(payment);
    }
    return apiRequest<PaymentRecord>(`/orders/${id}/payments/qris`, { method: "POST" }).then(
      (response) => ({ ...response, data: normalizePayment(response.data) }),
    );
  },
  payBank: (id: string, body: { bank: string }) => {
    if (USE_MOCK) {
      const records = readStorage<PaymentRecord[]>(PAYMENTS_KEY, []);
      const existing = records.find((payment) => payment.orderId === id);
      if (existing) return mockResponse(existing);
      const order = readStorage<Order[]>(ORDERS_KEY, mockOrders).find((item) => item._id === id)!;
      const payment: PaymentRecord = {
        _id: `payment-${Date.now()}`,
        orderId: id,
        method: "bank_transfer",
        status: "pending",
        amount: order.total,
        createdAt: new Date().toISOString(),
        paymentData: {
          bankName: body.bank.toUpperCase(),
          virtualAccount: "3901081234567890",
        },
      };
      writeStorage(PAYMENTS_KEY, [...records, payment]);
      return mockResponse(payment);
    }
    return apiRequest<PaymentRecord>(`/orders/${id}/payments/bank-transfer`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((response) => ({ ...response, data: normalizePayment(response.data) }));
  },
  adminList: (status = "") => {
    if (USE_MOCK) {
      const orders = readStorage<Order[]>(ORDERS_KEY, mockOrders);
      return mockResponse(status ? orders.filter((order) => order.status === status) : orders);
    }
    return apiRequest<Order[]>(`/admin/orders${status ? `?status=${status}` : ""}`);
  },
  updateStatus: (id: string, body: { status: Order["status"] }) => {
    if (USE_MOCK) {
      const updated = readStorage<Order[]>(ORDERS_KEY, mockOrders).map((order) =>
        order._id === id ? { ...order, status: body.status } : order,
      );
      writeStorage(ORDERS_KEY, updated);
      return mockResponse(updated.find((order) => order._id === id)!);
    }
    return apiRequest<Order>(`/admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
};
