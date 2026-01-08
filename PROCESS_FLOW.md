# Ankiya Cloud Platform - Process Flow

This document explains the complete flow for how end users can buy machines, receive invoices, add users, and assign machines.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ANKIYA CLOUD PLATFORM FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User Registration     2. Organization Setup    3. Machine Purchase     │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │  Keycloak   │    →     │   Create    │    →     │   Browse    │        │
│  │   Login     │          │   Studio    │          │   Catalog   │        │
│  └─────────────┘          └─────────────┘          └─────────────┘        │
│                                                           │                 │
│                                                           ▼                 │
│  6. Machine Use           5. Admin Provision       4. Payment              │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │    DCV      │    ←     │  Provision  │    ←     │  Razorpay   │        │
│  │   Access    │          │  Machines   │          │  Checkout   │        │
│  └─────────────┘          └─────────────┘          └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. User Registration & Authentication

### Flow:
1. User visits the platform
2. Clicks "Sign In" → Redirected to Keycloak
3. Can register or login via Keycloak
4. After successful auth, redirected back to platform
5. User record synced to local database

### Backend Endpoints:
- Keycloak handles all authentication
- `POST /api/users/sync` - Syncs user data from Keycloak to local DB

### Frontend:
- [AuthContext.tsx](src/app/contexts/AuthContext.tsx) - Manages Keycloak auth state

---

## 2. Organization Setup

### Flow:
1. After login, user with no organization is prompted to create one
2. User fills organization details (Studio Name, Contact Info)
3. Organization created in both Keycloak and local DB
4. User becomes STUDIO_ADMIN of the organization

### Backend Endpoints:
- `POST /api/organizations` - Create new organization
- `GET /api/organizations/me` - Get current user's organization

### Frontend:
- [OrganizationSignupPage.tsx](src/app/pages/OrganizationSignupPage.tsx)
- [SettingsPage.tsx](src/app/pages/SettingsPage.tsx)

---

## 3. Machine Purchase (Quote → Order)

### Flow:
1. User browses machine catalog on Quote page
2. Selects machine configuration(s) and quantity
3. Optionally applies discount code
4. Clicks "Get Machines" to create order
5. Order created with status `PENDING_PAYMENT`

### Backend Endpoints:
- `GET /api/machines/catalog` - Get available machine configurations
- `POST /api/orders` - Create new order

### Request Body (Create Order):
```json
{
  "machineConfigId": "clxxxx...",
  "quantity": 2,
  "duration": 12  // months
}
```

### Response:
```json
{
  "order": {
    "id": "clxxxx...",
    "orderNumber": "ORD-1234567890-ABC123",
    "status": "PENDING_PAYMENT",
    "totalAmount": 599760
  },
  "razorpayOrder": {
    "id": "order_xxxx",
    "amount": 59976000,  // paise
    "currency": "INR"
  }
}
```

### Frontend:
- [QuotePage.tsx](src/app/pages/QuotePage.tsx)

---

## 4. Payment Processing

### Flow:
1. After order creation, Razorpay checkout opens
2. User completes payment
3. Frontend receives payment confirmation
4. Backend verifies payment signature
5. Order status updated to `PAID`
6. Support ticket automatically created for admin

### Backend Endpoints:
- `POST /api/orders/verify-payment` - Verify Razorpay payment

### Request Body:
```json
{
  "orderId": "order_xxxx",
  "paymentId": "pay_xxxx",
  "signature": "xxxxx"
}
```

### What Happens After Payment:
1. Order marked as `PAID`
2. Ticket created: "Machine Provisioning Request - ORD-xxx"
3. Email sent to organization contact email
4. Admin notified of new provisioning request

### For Mock/Development Mode:
- Set `RAZORPAY_MOCK_MODE=true` in backend
- Use `/api/mock-payment/:orderId` to simulate payment

---

## 5. Invoice Generation

### How Invoices Work:
- Invoices are generated from **paid orders**
- Each order becomes an invoice when payment is confirmed
- The order number serves as the invoice number (e.g., `ORD-1234567890-ABC123`)

### Viewing Invoices:
- Users can view invoices on the Invoices page
- Shows all orders with status `PAID` or `PENDING_PAYMENT`

### Backend Endpoints:
- `GET /api/orders` - Returns all orders (used as invoices)

### Invoice Data Structure:
```json
{
  "id": "clxxxx...",
  "invoiceNumber": "ORD-1234567890-ABC123",
  "date": "2026-01-02",
  "amount": 599760,
  "status": "paid",
  "items": [
    { "name": "VFX Pro Workstation", "quantity": 2, "price": 299880 }
  ]
}
```

### Frontend:
- [InvoicesPage.tsx](src/app/pages/InvoicesPage.tsx)
- [CloudContext.tsx](src/app/contexts/CloudContext.tsx) - Maps orders to invoices

---

## 6. Admin Machine Provisioning

### Flow (Platform Admin):
1. Admin views open tickets in admin dashboard
2. Selects provisioning ticket
3. Creates machine with DCV connection details
4. Machine linked to order and organization
5. Order status updated to `COMPLETED`

### Backend Endpoints:
- `GET /api/admin/tickets` - List all tickets
- `POST /api/admin/machines/provision` - Create and provision machine

### Request Body (Provision Machine):
```json
{
  "ticketId": "clxxxx...",
  "machineName": "RENDER-01",
  "dcvHost": "192.168.1.100",
  "dcvPort": 8443,
  "dcvUsername": "user01",
  "startDate": "2026-01-02",
  "expiryDate": "2027-01-02"
}
```

### What Gets Created:
- Machine record with DCV credentials
- Random DCV password generated
- DCV connection link formatted

---

## 7. Inviting Users to Organization

### Flow:
1. Studio Admin goes to Users page
2. Clicks "Invite User"
3. Enters email, name, and role
4. Invitation sent via email
5. User clicks link and registers/logs in
6. User automatically added to organization

### Backend Endpoints:
- `POST /api/invitations` - Create invitation
- `GET /api/invitations/accept/:token` - Accept invitation

### Request Body (Send Invitation):
```json
{
  "email": "artist@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "STUDIO_USER"
}
```

### Invitation Email Contains:
- Link: `https://platform.url/accept-invitation?token=xxxx`
- Expires in 7 days

### Frontend:
- [UsersPage.tsx](src/app/pages/UsersPage.tsx)
- [AcceptInvitationPage.tsx](src/app/pages/AcceptInvitationPage.tsx)

---

## 8. Assigning Machines to Users

### Flow:
1. Studio Admin views Machines page
2. Finds unassigned machine (status: `free`)
3. Clicks "Assign" button
4. Selects user from organization
5. Optionally adds task description
6. Machine assigned and credentials emailed to user

### Backend Endpoints:
- `GET /api/machines` - List organization's machines
- `GET /api/machines/users` - List organization's users
- `POST /api/admin/machines/assign` - Assign machine to user

### Request Body (Assign Machine):
```json
{
  "machineId": "clxxxx...",
  "userId": "clxxxx...",
  "task": "VFX Compositing Work"
}
```

### What Happens:
1. MachineAssignment record created
2. Machine status changed to `RUNNING`
3. Email sent to user with:
   - Machine name
   - DCV connection link
   - Username & password
   - Expiry date
   - Task description

### Frontend:
- [MachinesPage.tsx](src/app/pages/MachinesPage.tsx)
- [CloudContext.tsx](src/app/contexts/CloudContext.tsx) - `assignMachineToUser()`

---

## 9. User Accessing Machine (DCV)

### Flow:
1. User receives email with DCV credentials
2. Opens DCV client or web browser
3. Connects using provided link/credentials
4. Access cloud workstation

### Connection Details in Email:
```
Machine: RENDER-01
DCV Link: dcv://192.168.1.100:8443
Username: user01
Password: [auto-generated]
Expires: January 2, 2027
```

---

## Database Models

### Key Models:
- **Organization** - Studio/company
- **User** - Platform users (linked to Keycloak)
- **MachineConfig** - Available machine types
- **MachineOrder** - Purchase orders
- **Machine** - Provisioned machines
- **MachineAssignment** - User-machine assignments
- **Ticket** - Support/provisioning tickets
- **Invoice** - Generated from paid orders
- **Invitation** - User invitations

### Status Enums:

**OrderStatus:**
- `PENDING_PAYMENT` → `PAID` → `PROCESSING` → `COMPLETED`
- Can also be: `CANCELLED`, `REFUNDED`

**MachineStatus:**
- `PROVISIONING` → `ACTIVE` → `RUNNING` (when assigned)
- Can also be: `STOPPED`, `EXPIRED`, `MAINTENANCE`, `TERMINATED`

---

## API Authentication

All protected endpoints require:
```
Authorization: Bearer <keycloak_token>
```

The middleware extracts:
- User ID (from Keycloak token)
- Organization ID (from user's organization)

Tenant isolation ensures users only see their organization's data.

---

## Development Setup

### Start Backend:
```bash
cd backend
npm run dev
```

### Start Frontend:
```bash
npm run dev
```

### Environment Variables (Backend):
```env
DATABASE_URL=postgresql://...
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=ankiya
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_MOCK_MODE=true  # For development
```

---

## Complete User Journey

```
1. Login via Keycloak
   ↓
2. Create Organization (if new user)
   ↓
3. Browse Quote Page → Select Machines
   ↓
4. Pay via Razorpay
   ↓
5. View Invoice (Orders page shows paid order)
   ↓
6. [Admin] Provision Machine with DCV details
   ↓
7. [Admin] Invite team members
   ↓
8. Users accept invitation
   ↓
9. Assign machines to users
   ↓
10. Users receive DCV credentials via email
   ↓
11. Users connect to cloud workstation
```

---

## Troubleshooting

### No machines showing:
- Machines only appear after admin provisions them
- Check if order was completed and machine provisioned

### Invoice not appearing:
- Invoices come from paid orders
- Check order status in database

### Can't assign machine:
- Need STUDIO_ADMIN or SUPER_ADMIN role
- Machine must be in `ACTIVE` (free) status
- User must be in same organization as machine

### User can't join organization:
- Check invitation hasn't expired
- Verify email matches invitation
