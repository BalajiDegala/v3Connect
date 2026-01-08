import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'ankiya-cloud',
    clientId: process.env.KEYCLOAK_CLIENT_ID || '',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  },
  
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    mockMode: process.env.RAZORPAY_MOCK_MODE === 'true' || !process.env.RAZORPAY_KEY_ID,
  },
  
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  
  email: {
    from: process.env.EMAIL_FROM || 'noreply@ankiyacloud.com',
  },
  
  nfs: {
    mountPath: process.env.NFS_MOUNT_PATH || '/mnt/ankiya-storage',
  },
  
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
  },
  
  session: {
    secret: process.env.SESSION_SECRET || 'change-this-secret',
  },
  
  admin: {
    notificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@ankiyacloud.com',
  },
  
  orders: {
    expiryHours: parseInt(process.env.ORDER_EXPIRY_HOURS || '24'),
  },
};
