const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware');
const { buyerRouter, adminRouter } = require('./routes/orders');
const { webhookRouter } = require('./routes/payments');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'WantToSell API berjalan' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api', require('./routes/addresses')); // /shipping-addresses, /shipping/estimate
app.use('/api/orders', buyerRouter);
app.use('/api/admin', adminRouter); // /admin/orders
app.use('/api/payments', webhookRouter); // /payments/webhook

app.use((req, res) => res.status(404).json({ success: false, message: `Rute ${req.method} ${req.originalUrl} tidak ditemukan` }));
app.use(errorHandler);

module.exports = app;
