const jwt = require('jsonwebtoken');
const { ZodError } = require('zod');
const { User } = require('../models');
const { AppError, asyncHandler } = require('../utils');

// Otorisasi: role pada collection users menentukan hak akses.
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'Token tidak ditemukan. Silakan login.');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Token tidak valid atau sudah kedaluwarsa.');
  }
  const user = await User.findById(payload.id);
  if (!user) throw new AppError(401, 'Pengguna tidak ditemukan.');
  req.user = user;
  next();
});

const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user.role) ? next() : next(new AppError(403, 'Anda tidak memiliki akses ke sumber daya ini.'));

const validate = (schema, source = 'body') => (req, _res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) return next(parsed.error);
  req[source] = parsed.data;
  next();
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validasi gagal',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.name === 'CastError') return res.status(400).json({ success: false, message: `ID tidak valid: ${err.value}` });
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: `Data duplikat: ${Object.keys(err.keyValue || {}).join(', ')}` });
  }
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'JSON tidak valid' });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ success: false, message: status === 500 ? 'Terjadi kesalahan pada server' : err.message });
}

module.exports = { authenticate, requireRole, validate, errorHandler };
