// Skema koleksi mengikuti "Diagram Database - Thrift Website" (Node.js + Express.js + MongoDB).
// Field di luar diagram ditandai "[ekstensi]" beserta alasannya.
const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const PRODUCT_STATUS = ['available', 'reserved', 'sold'];
const ORDER_STATUS = ['waiting_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
const PAYMENT_STATUS = ['pending', 'success', 'failed', 'expired'];

// ---------- users ----------
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false }, // [ekstensi] hash bcrypt untuk login email/password; kosong bila login Google
    avatar: { type: String },
    role: { type: String, enum: ['buyer', 'admin'], default: 'buyer' },
    googleId: { type: String, unique: true, sparse: true },
    phone: { type: String },
  },
  { timestamps: true }
);

// ---------- products ----------
const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, required: true, trim: true, lowercase: true },
    brand: { type: String, trim: true },
    // Ukuran presisi dalam cm (bukan size chart standar)
    size: {
      label: { type: String, required: true },
      chest: { type: Number, required: true, min: 1 },
      length: { type: Number, required: true, min: 1 },
    },
    // Dokumentasi cacat: grade, deskripsi, minus tags, catatan penjual
    condition: {
      grade: { type: String, required: true, enum: ['A', 'B', 'C'] },
      description: { type: String, default: '' },
      minusTags: { type: [String], default: [] }, // [ekstensi] "tag minus" (fitur 2 di rancangan)
      sellerNote: { type: String, default: '' }, // [ekstensi] "catatan penjual" (fitur 2 di rancangan)
    },
    price: { type: Number, required: true, min: 0 },
    images: {
      type: [String],
      validate: { validator: (v) => v.length === 4, message: 'Produk wajib memiliki 4 foto (4 sudut)' },
    },
    weight: { type: Number, default: 500, min: 1 }, // [ekstensi] gram, dasar hitung ongkir otomatis
    status: { type: String, enum: PRODUCT_STATUS, default: 'available' },
  },
  { timestamps: true }
);
productSchema.index({ status: 1 }); // "products.status (untuk pencarian cepat)"
productSchema.index({ category: 1, status: 1 });
productSchema.index({ price: 1 });

// ---------- shipping_addresses ----------
const shippingAddressSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    province: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    address: { type: String, required: true },
    postalCode: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ---------- orders ----------
const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    items: [
      {
        _id: false,
        productId: { type: ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, default: 1 },
      },
    ],
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, required: true },
    total: { type: Number, required: true },
    shippingAddressId: { type: ObjectId, ref: 'ShippingAddress', required: true },
    shipping: {
      courier: { type: String, required: true },
      service: { type: String, required: true },
      trackingNumber: { type: String, default: null },
    },
    status: { type: String, enum: ORDER_STATUS, default: 'waiting_payment' },
    expiresAt: { type: Date }, // [ekstensi] batas waktu bayar; setelah lewat, barang dilepas kembali
  },
  { timestamps: true }
);
orderSchema.index({ status: 1, expiresAt: 1 });
orderSchema.index({ 'items.productId': 1 });

// ---------- payments ----------
const paymentSchema = new Schema(
  {
    orderId: { type: ObjectId, ref: 'Order', required: true, index: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    transactionId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true, enum: ['qris', 'bank_transfer'] },
    status: { type: String, enum: PAYMENT_STATUS, default: 'pending' },
    paidAt: { type: Date },
    expiresAt: { type: Date }, // [ekstensi] "waktu pembayaran habis" (status expired)
    paymentData: { type: Object }, // [ekstensi] qrString / nomor VA yang ditampilkan ke pembeli
  },
  { timestamps: true }
);

// ---------- wishlists ----------
const wishlistSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    productId: { type: ObjectId, ref: 'Product', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

// ---------- reviews ----------
const reviewSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    productId: { type: ObjectId, ref: 'Product', required: true, index: true },
    orderId: { type: ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
);
reviewSchema.index({ userId: 1, productId: 1, orderId: 1 }, { unique: true });

module.exports = {
  User: mongoose.model('User', userSchema, 'users'),
  Product: mongoose.model('Product', productSchema, 'products'),
  ShippingAddress: mongoose.model('ShippingAddress', shippingAddressSchema, 'shipping_addresses'),
  Order: mongoose.model('Order', orderSchema, 'orders'),
  Payment: mongoose.model('Payment', paymentSchema, 'payments'),
  Wishlist: mongoose.model('Wishlist', wishlistSchema, 'wishlists'),
  Review: mongoose.model('Review', reviewSchema, 'reviews'),
  PRODUCT_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
};
