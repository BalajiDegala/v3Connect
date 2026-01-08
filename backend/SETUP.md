# Ankiya Cloud - Complete Setup Guide

## 🎯 System Architecture

**Ankiya Cloud** is a multi-tenant B2B SaaS platform for VFX/Media studios to manage cloud machines with:
- **Keycloak** for organization & user management (SSO)
- **PostgreSQL** for data persistence
- **Razorpay** for payments
- **NFS** for file storage
- **Email notifications** with DCV links

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+
- **Keycloak** 25+
- **SMTP server** (Gmail/SendGrid)
- **Razorpay account**

---

## 🚀 Part 1: Keycloak Setup

### 1.1 Install & Start Keycloak

```bash
# Download Keycloak
# https://www.keycloak.org/downloads

# Start Keycloak
cd keycloak-25.0.0
bin\kc.bat start-dev --http-port 8080
```

### 1.2 Configure Keycloak

1. **Access Admin Console**: http://localhost:8080
2. **Create Admin** user (first time)
3. **Create Realm**: `ankiya-cloud`

### 1.3 Create Client

1. Go to **Clients** → **Create Client**
2. **Client ID**: `ankiya-cloud-backend`
3. **Client Protocol**: `openid-connect`
4. **Access Type**: `confidential`
5. **Valid Redirect URIs**: `http://localhost:5000/*`
6. **Web Origins**: `http://localhost:5173`
7. Save and copy **Client Secret**

### 1.4 Create Roles

1. Go to **Realm Roles** → **Create Role**
2. Create these roles:
   - `SUPER_ADMIN` (Ankiya admin)
   - `ORG_ADMIN` (Studio admin)
   - `MANAGER` (Studio manager)
   - `USER` (Studio user)

### 1.5 Add Custom Claim for Organization

1. Go to **Client Scopes** → **Create**
2. Name: `organization`
3. Add **Mapper**:
   - Type: `User Attribute`
   - Name: `organizationId`
   - User Attribute: `organizationId`
   - Token Claim Name: `organizationId`

### 1.6 Create Test Organization & Users

1. **Create User** → Set email, name
2. **Credentials** → Set password
3. **Attributes** → Add `organizationId` = `org-test-001`
4. **Role Mappings** → Assign `ORG_ADMIN` or `USER`

---

## 🗄️ Part 2: Database Setup

### 2.1 Install PostgreSQL

```bash
# Windows: Download from postgresql.org
# Or use Docker:
docker run --name ankiya-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:14
```

### 2.2 Create Database

```sql
CREATE DATABASE ankiya_cloud;
CREATE USER ankiya_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ankiya_cloud TO ankiya_user;
```

---

## ⚙️ Part 3: Backend Setup

### 3.1 Install Dependencies

```bash
cd backend
npm install
```

### 3.2 Configure Environment

```bash
# Copy .env.example to .env
cp .env.example .env
```

**Edit `.env`:**

```env
DATABASE_URL="postgresql://ankiya_user:your_secure_password@localhost:5432/ankiya_cloud"

# Server
PORT=5000
NODE_ENV=development

# Keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=ankiya-cloud
KEYCLOAK_CLIENT_ID=ankiya-cloud-backend
KEYCLOAK_CLIENT_SECRET=<your-client-secret-from-keycloak>

# Razorpay
RAZORPAY_KEY_ID=<your-razorpay-key-id>
RAZORPAY_KEY_SECRET=<your-razorpay-secret>
RAZORPAY_WEBHOOK_SECRET=<your-webhook-secret>

# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<your-app-password>
EMAIL_FROM=noreply@ankiyacloud.com

# NFS
NFS_MOUNT_PATH=/mnt/ankiya-storage

# Frontend
FRONTEND_URL=http://localhost:5173

# Secrets
JWT_SECRET=<generate-random-secret>
SESSION_SECRET=<generate-random-secret>
```

### 3.3 Setup Database Schema

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Optional: Open Prisma Studio
npm run prisma:studio
```

### 3.4 Seed Initial Data (Optional)

Create `backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create machine configurations
  await prisma.machineConfig.createMany({
    data: [
      {
        name: 'Starter VFX',
        cpu: '4 vCPU',
        ram: '16 GB',
        storage: '250 GB SSD',
        gpu: 'NVIDIA T4',
        pricePerMonth: 15000,
      },
      {
        name: 'Pro Render',
        cpu: '8 vCPU',
        ram: '32 GB',
        storage: '500 GB SSD',
        gpu: 'NVIDIA A10',
        pricePerMonth: 30000,
      },
      {
        name: 'Enterprise',
        cpu: '16 vCPU',
        ram: '64 GB',
        storage: '1 TB SSD',
        gpu: 'NVIDIA A100',
        pricePerMonth: 60000,
      },
    ],
  });

  console.log('✅ Seed data created!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run: `npx tsx prisma/seed.ts`

### 3.5 Start Backend

```bash
npm run dev
```

Backend running at: **http://localhost:5000**

---

## 💳 Part 4: Razorpay Setup

1. Sign up at **https://razorpay.com/**
2. Get **Key ID** and **Key Secret** from Dashboard
3. Setup **Webhook**:
   - URL: `http://your-domain.com/api/payments/webhook`
   - Events: `payment.captured`, `payment.failed`
   - Copy **Webhook Secret**

---

## 🎨 Part 5: Frontend Integration

### 5.1 Update Frontend .env

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=ankiya-cloud
VITE_KEYCLOAK_CLIENT_ID=ankiya-cloud-frontend
VITE_RAZORPAY_KEY_ID=<your-razorpay-key-id>
```

### 5.2 Install Additional Dependencies

```bash
cd ..  # Back to root
npm install axios @react-keycloak/web keycloak-js react-query
```

---

## 🔐 Part 6: Testing the Flow

### 6.1 Studio Registration Flow

1. **Studio registers** in Keycloak
2. **Admin creates organization** in database with Keycloak org ID
3. **Studio adds users** in Keycloak with `organizationId` attribute

### 6.2 Machine Purchase Flow

1. Studio browses machine catalog
2. Selects config, quantity, duration
3. Creates order → **Razorpay payment**
4. Payment success → **Ticket created** for admin
5. Admin sees ticket in admin panel

### 6.3 Admin Provisioning Flow

1. Admin views tickets
2. Creates machine in infrastructure
3. Calls **POST /api/admin/machines/provision** with DCV details
4. Machine created in database
5. Admin assigns machine to user
6. **User receives email** with DCV link & credentials

---

## 📧 Email Template Test

The email sent to users looks like this:

```
Subject: 🎬 Your Machine RENDER-01 is Ready - DCV Access Details

Hello John Doe,

Your machine RENDER-01 is ready!

🔐 Connection Details:
- DCV Link: dcv://10.0.0.5:8443
- Username: user01
- Password: Abc123Xyz789
- Valid Until: 2027-01-01

[Connect Now Button]
```

---

## 🛠️ API Endpoints

### Public
- `GET /health` - Health check

### Protected (Requires Auth)
- `POST /api/orders` - Create machine order
- `POST /api/orders/verify-payment` - Verify Razorpay payment
- `GET /api/orders` - Get orders
- `GET /api/machines` - Get machines
- `GET /api/machines/configs` - Get machine catalog
- `GET /api/machines/users` - Get organization users

### Admin Only
- `GET /api/admin/tickets` - Get all tickets
- `PATCH /api/admin/tickets/:id` - Update ticket
- `POST /api/admin/machines/provision` - Provision machine
- `POST /api/admin/machines/assign` - Assign machine to user
- `GET /api/admin/machines` - Get all machines (cross-org)

---

## 🔒 Security Features

- ✅ **Keycloak SSO** for authentication
- ✅ **Role-based access control** (RBAC)
- ✅ **Multi-tenant data isolation**
- ✅ **Rate limiting** on API endpoints
- ✅ **Payment signature verification**
- ✅ **Audit logging** for all actions
- ✅ **Helmet.js** security headers
- ✅ **CORS** protection

---

## 📊 Database Schema Highlights

- **Organization** - Multi-tenant isolation
- **User** - Tied to Keycloak users
- **MachineConfig** - Machine catalog
- **MachineOrder** - Purchase orders
- **Ticket** - Admin provisioning requests
- **Machine** - Actual provisioned machines
- **MachineAssignment** - User-machine mapping
- **Invoice** - Billing & payments
- **AuditLog** - Audit trail

---

## 🚀 Production Deployment

1. **Use proper SSL certificates** (Let's Encrypt)
2. **Encrypt passwords** in database (use crypto/bcrypt)
3. **Use Redis** for session storage (not memory)
4. **Setup proper NFS** mount permissions
5. **Configure Keycloak** in production mode
6. **Use environment-based configs**
7. **Setup monitoring** (Prometheus, Grafana)
8. **Configure email** with proper SMTP (SendGrid, AWS SES)
9. **Setup backups** for PostgreSQL
10. **Rate limiting** with Redis

---

## 📝 Next Steps

1. ✅ Backend API created
2. ⏳ Update frontend with Keycloak integration
3. ⏳ Create admin panel UI
4. ⏳ Implement WebSocket for real-time updates
5. ⏳ Add file upload to NFS
6. ⏳ Create reporting dashboard
7. ⏳ Setup CI/CD pipeline

---

## 🆘 Support

For issues or questions, contact: **support@ankiyacloud.com**

---

**Built with ❤️ for VFX Studios**
