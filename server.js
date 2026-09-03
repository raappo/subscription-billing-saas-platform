require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const connectDB = require('./config/db');
const swaggerSpec = require('./config/swagger');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const planRoutes = require('./routes/planRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const usageRoutes = require('./routes/usageRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const couponRoutes = require('./routes/couponRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// ─── Security & Utility Middleware ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // disabled for Swagger UI and frontend dashboard
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
  },
});
app.use('/api/', limiter);

// ─── Static Files (for frontend dashboard) ────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Health Check ─────────────────────────────────────────────────────────────
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running.',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/dashboard', dashboardRoutes);
// Admin reports — mounted at /api/admin/reports (handled inside dashboardRoutes)
app.use('/api', dashboardRoutes);

// ─── Swagger Docs ─────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SaaS Billing API Docs',
}));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
    errorCode: 'NOT_FOUND',
  });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use(errorHandler);

// ─── Server Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
  return server;
};

// Only start if this file is run directly (not imported for testing)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
