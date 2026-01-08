import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { sessionMiddleware, keycloak } from './middleware/keycloak.js';
import { errorHandler, requestLogger, apiLimiter } from './middleware/index.js';
import { startOrderExpiryJob } from './jobs/orderExpiryJob.js';
import { startMachineExpiryJob } from './jobs/machineExpiryJob.js';

// Routes
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import machineRoutes from './routes/machineRoutes.js';
import mockPaymentRoutes from './routes/mockPayment.js';
import userRoutes from './routes/userRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import showRoutes from './routes/showRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [config.frontend.url, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session and Keycloak
app.use(sessionMiddleware);
app.use(keycloak.middleware());

// Logging
app.use(requestLogger);

// Rate limiting
app.use('/api/', apiLimiter);

// Health check (both paths for compatibility)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'connected',
      keycloak: config.keycloak.url,
    }
  });
});

// Public config endpoint (safe to expose)
app.get('/api/config', (req, res) => {
  res.json({
    payment: {
      mockMode: config.razorpay.mockMode,
      keyId: config.razorpay.mockMode ? 'rzp_test_mock' : config.razorpay.keyId,
    },
    features: {
      razorpayEnabled: !config.razorpay.mockMode,
    }
  });
});

// API Routes
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/mock-payment', mockPaymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/invoices', invoiceRoutes);

// Error handling
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
  🚀 Ankiya Cloud Backend Server
  ================================
  Server running on: http://localhost:${PORT}
  Environment: ${config.nodeEnv}
  Keycloak: ${config.keycloak.url}
  ================================
  `);
  
  // Start background jobs
  startOrderExpiryJob();
  startMachineExpiryJob();
});

export default app;
