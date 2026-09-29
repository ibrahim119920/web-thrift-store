const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { User } = require('../models');
const { AppError, asyncHandler, ok } = require('../utils');
const { authenticate, validate } = require('../middleware');

const phone = z.string().regex(/^(\+62|62|0)8[0-9]{8,12}$/, 'Nomor telepon Indonesia tidak valid');

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  phone: phone.optional(),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const publicUser = (u) => ({ _id: u._id, name: u.name, email: u.email, phone: u.phone, avatar: u.avatar, role: u.role });

// Registrasi publik selalu menghasilkan role "buyer". Admin hanya dibuat lewat seed.
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, phone: ph } = req.body;
    if (await User.exists({ email })) throw new AppError(409, 'Email sudah terdaftar');
    const user = await User.create({ name, email, phone: ph, password: await bcrypt.hash(password, 10), role: 'buyer' });
    ok(res, { ...publicUser(user), token: signToken(user) }, 'Registrasi akun berhasil!', 201);
  })
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+password');
    const valid = user?.password && (await bcrypt.compare(req.body.password, user.password));
    if (!valid) throw new AppError(401, 'Email atau kata sandi salah');
    ok(res, { ...publicUser(user), token: signToken(user) }, 'Login berhasil!');
  })
);

router.get('/me', authenticate, (req, res) => ok(res, publicUser(req.user)));

module.exports = router;
