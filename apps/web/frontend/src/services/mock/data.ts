import type { Order, Product, Review, User } from "../../types";

const images = [
  "/assets/5656c.png",
  "/assets/191aa.png",
  "/assets/a5269.png",
  "/assets/a6681.png",
  "/assets/d8868.png",
  "/assets/86b4b.png",
];
const seeds = [
  ["Kemeja Plaid Weekend", "kemeja", "Anonymous", 85000],
  ["Kaos Rugby Navy", "kaos", "Harrington", 65000],
  ["Jaket Corduroy Cokelat", "jaket", "Levi’s", 175000],
  ["Celana Cargo Utility", "celana", "Dickies", 145000],
  ["Hoodie College Grey", "hoodie", "Champion", 125000],
  ["Blouse Ribbon Pink", "blouse", "Mango", 95000],
  ["Sweater Knit Forest", "sweater", "Uniqlo", 110000],
  ["Kemeja Oxford Biru", "kemeja", "Muji", 90000],
  ["Kaos Graphic 90s", "kaos", "Fruit of the Loom", 70000],
  ["Jaket Denim Washed", "jaket", "Lee", 190000],
  ["Celana Pleated Black", "celana", "Giordano", 115000],
  ["Hoodie Zip Maroon", "hoodie", "Russell", 130000],
] as const;

export const mockProducts: Product[] = seeds.map(([name, category, brand, price], index) => ({
  _id: `product-${index + 1}`,
  name,
  description: "Pilihan preloved terkurasi dengan kondisi yang dijelaskan apa adanya.",
  category,
  brand,
  size: {
    chest: 52 + (index % 5) * 2,
    length: 67 + (index % 4) * 2,
  },
  condition: {
    grade: index % 4 ? "A" : "B",
    description: "Kondisi terawat dan siap dipakai.",
    minusTags: index % 4 ? [] : ["fading ringan"],
    sellerNote: "Warna dapat sedikit berbeda karena pencahayaan.",
  },
  price,
  images: Array.from(
    { length: 4 },
    (_, imageIndex) => images[(index + imageIndex) % images.length],
  ),
  weight: 300 + index * 35,
  status: index === 10 ? "sold" : index === 11 ? "reserved" : "available",
  createdAt: new Date(2026, 1, 15 - index).toISOString(),
}));

const comments = [
  "Barang sesuai deskripsi, detail minusnya jujur dan pengiriman cepat.",
  "Kondisi masih bagus banget. Ukuran dan deskripsi sangat membantu.",
  "Packing rapi dan bajunya sudah bersih. Bakal cari preloved lagi di sini.",
  "Pilihan itemnya unik dan proses belinya mudah.",
  "Bahannya masih nyaman, persis seperti yang dijelaskan.",
  "Respons cepat dan kualitas produknya memuaskan.",
];

export const mockReviews: Review[] = comments.map((comment, index) => ({
  _id: `review-${index + 1}`,
  rating: index === 4 ? 4 : 5,
  comment,
  user: { name: ["Karina A.", "Ainun R.", "Rafael P.", "Dina M.", "Raka N.", "Sarah K."][index] },
  product: {
    _id: mockProducts[index]._id,
    name: mockProducts[index].name,
    category: mockProducts[index].category,
  },
  createdAt: new Date(2026, 1, 20 - index).toISOString(),
}));

export const mockUsers: User[] = [
  {
    _id: "buyer-1",
    name: "Pembeli Demo",
    email: "buyer@demo.id",
    phone: "081234567890",
    role: "buyer",
  },
  {
    _id: "admin-1",
    name: "Admin Demo",
    email: "admin@demo.id",
    phone: "081234567891",
    role: "admin",
  },
];

export const mockOrders: Order[] = [
  {
    _id: "order-demo-1",
    orderNumber: "WTS-20260308-103421",
    items: [
      {
        productId: mockProducts[0]._id,
        name: mockProducts[0].name,
        price: mockProducts[0].price,
        qty: 1,
      },
    ],
    subtotal: 85000,
    shippingCost: 18000,
    total: 103000,
    shippingAddressId: "address-1",
    shipping: { courier: "jne", service: "reg" },
    status: "waiting_payment",
    expiresAt: "2027-03-09T12:00:00.000Z",
  },
  {
    _id: "order-demo-2",
    orderNumber: "WTS-20260302-092815",
    items: [
      {
        productId: mockProducts[2]._id,
        name: mockProducts[2].name,
        price: mockProducts[2].price,
        qty: 1,
      },
      {
        productId: mockProducts[5]._id,
        name: mockProducts[5].name,
        price: mockProducts[5].price,
        qty: 1,
      },
    ],
    subtotal: 270000,
    shippingCost: 30000,
    total: 300000,
    shippingAddressId: "address-1",
    shipping: { courier: "jne", service: "yes", trackingNumber: "JNE2603028291" },
    status: "shipped",
    expiresAt: "2026-03-03T12:00:00.000Z",
  },
  {
    _id: "order-demo-3",
    orderNumber: "WTS-20260221-181204",
    items: [
      {
        productId: mockProducts[6]._id,
        name: mockProducts[6].name,
        price: mockProducts[6].price,
        qty: 1,
      },
    ],
    subtotal: 110000,
    shippingCost: 19000,
    total: 129000,
    shippingAddressId: "address-2",
    shipping: { courier: "tiki", service: "reg", trackingNumber: "TIKI2602214402" },
    status: "completed",
    expiresAt: "2026-02-22T12:00:00.000Z",
  },
  {
    _id: "order-demo-4",
    orderNumber: "WTS-20260217-141011",
    items: [
      {
        productId: mockProducts[4]._id,
        name: mockProducts[4].name,
        price: mockProducts[4].price,
        qty: 1,
      },
    ],
    subtotal: 125000,
    shippingCost: 18000,
    total: 143000,
    shippingAddressId: "address-3",
    shipping: { courier: "jne", service: "reg" },
    status: "processing",
    expiresAt: "2026-02-18T12:00:00.000Z",
  },
];
