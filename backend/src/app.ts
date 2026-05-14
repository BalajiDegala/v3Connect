import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { sessionMiddleware, keycloak } from './middleware/keycloak.js';
import { errorHandler, requestLogger, apiLimiter } from './middleware/index.js';

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

export function createApp() {
  const app = express();
  const configuredOrigins = [
    config.frontend.url,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://ankiya.vercel.app',
    'https://connectank.vercel.app',
  ].filter((v): v is string => Boolean(v));

  const allowVercelPreview = (origin: string) =>
    /^https:\/\/connectank-[a-z0-9-]+-balaji-degalas-projects\.vercel\.app$/i.test(origin);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow server-to-server and health probes with no Origin header.
        if (!origin) return callback(null, true);
        if (configuredOrigins.includes(origin) || allowVercelPreview(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(sessionMiddleware);
  app.use(keycloak.middleware());

  app.use(requestLogger);
  app.use('/api/', apiLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        keycloak: config.keycloak.url,
      },
    });
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      payment: {
        mockMode: config.razorpay.mockMode,
        keyId: config.razorpay.mockMode ? 'rzp_test_mock' : config.razorpay.keyId,
      },
      features: {
        razorpayEnabled: !config.razorpay.mockMode,
      },
    });
  });

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

  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
