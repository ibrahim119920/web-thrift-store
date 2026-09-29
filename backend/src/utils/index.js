const mongoose = require('mongoose');

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data, message, status = 200, extra = {}) =>
  res.status(status).json({ success: true, ...(message && { message }), ...extra, data });

// Menjalankan fn di dalam transaksi MongoDB (butuh replica set). Error di dalam fn membatalkan (rollback) semua.
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parsePaging(query, defaultLimit = 10) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

const paginationMeta = (total, page, limit) => ({
  totalData: total,
  totalPages: Math.ceil(total / limit),
  currentPage: page,
  limit,
});

module.exports = { AppError, asyncHandler, ok, withTransaction, escapeRegex, parsePaging, paginationMeta };
