# Ankiya Cloud Platform

A comprehensive **multi-tenant B2B SaaS platform** for VFX and Media studios to manage cloud machines with enterprise-grade features.

## 🎯 Key Features

- 🏢 **Multi-tenant architecture** with organization isolation
- 🔐 **Keycloak SSO** for authentication & user management
- 💳 **Razorpay integration** for seamless payments
- 🎫 **Admin ticket system** for machine provisioning
- 📧 **Automated email notifications** with DCV credentials
- 🖥️ **Machine management** with full lifecycle tracking
- 👥 **User assignment** with task tracking
- 📊 **Real-time dashboards** and analytics
- 🔒 **Enterprise security** with RBAC and audit logs

## 🏗️ Architecture

### Frontend
- **React 18** + **TypeScript**
- **Vite** for blazing-fast builds
- **Tailwind CSS** + **shadcn/ui** components
- **React Router** for navigation
- **Keycloak.js** for SSO integration

### Backend
- **Node.js** + **Express**
- **TypeScript** for type safety
- **Prisma ORM** with PostgreSQL
- **Keycloak Connect** for authentication
- **Razorpay SDK** for payments
- **Nodemailer** for email delivery

### Infrastructure
- **PostgreSQL 14+** - Main database
- **Keycloak 25+** - Identity & Access Management
- **NFS** - File storage
- **Razorpay** - Payment gateway

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Keycloak 25+

### Setup

```bash
# Clone and install
git clone <repository>
cd ConnectAnk

# Run setup script (Windows)
pwsh setup.ps1

# Configure environment variables
# Edit backend/.env and .env

# Start backend
cd backend
npm run dev

# Start frontend (new terminal)
cd ..
npm run dev
```

## 📖 Documentation

- **[Complete Setup Guide](backend/SETUP.md)** - Detailed setup instructions
- **Architecture Overview** - System design and workflows

## 🔐 Security

- Multi-tenant data isolation
- Role-based access control (SUPER_ADMIN, ORG_ADMIN, MANAGER, USER)
- Rate limiting and DDoS protection
- Payment signature verification
- Encrypted sensitive data
- Audit logging for compliance

## 📊 Workflow

1. **Studio Registration** → Keycloak organization setup
2. **User Management** → Add users to organization
3. **Browse Catalog** → View available machine configurations
4. **Purchase Machines** → Razorpay payment integration
5. **Ticket Creation** → Automatic admin notification
6. **Admin Provisioning** → Create machines with DCV access
7. **User Assignment** → Email with credentials sent automatically
8. **Machine Access** → Users connect via DCV link

## 🛠️ Tech Stack

**Frontend:**
- React, TypeScript, Vite
- Tailwind CSS, shadcn/ui
- React Query, Axios
- Keycloak.js

**Backend:**
- Node.js, Express, TypeScript
- Prisma, PostgreSQL
- Keycloak Connect
- Razorpay, Nodemailer

**DevOps:**
- Docker support
- CI/CD ready
- Monitoring & logging

## 📧 Contact

For support or inquiries: **support@ankiyacloud.com**

## 📄 License

Proprietary - © 2026 Ankiya Cloud

---

**Built for VFX Studios by VFX Professionals** 🎬
  