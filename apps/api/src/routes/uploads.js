const router = require('express').Router();
const { z } = require('zod');
const { asyncHandler, ok } = require('../utils');
const { authenticate, requireRole, validate } = require('../middlewares');
const { createProductImageUpload } = require('../services/storageService');

const uploadSchema = z.object({
  contentType: z.string().trim().toLowerCase(),
  size: z.number().int().positive(), // byte, dicek ulang lewat HeadObject saat produk disimpan
});

// Admin meminta presigned URL, lalu meng-upload foto langsung ke S3 dengan PUT.
router.post(
  '/product-image',
  authenticate,
  requireRole('admin'),
  validate(uploadSchema),
  asyncHandler(async (req, res) => {
    ok(res, await createProductImageUpload(req.body), 'URL upload berhasil dibuat', 201);
  })
);

module.exports = router;
