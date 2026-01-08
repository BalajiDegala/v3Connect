import { Router } from 'express';
import { machineOrderController } from '../controllers/orderController.js';
import { protect, extractUserInfo, checkRole } from '../middleware/keycloak.js';
import { tenantIsolation, paymentLimiter } from '../middleware/index.js';

const router = Router();

// All routes require authentication
router.use(protect, extractUserInfo, tenantIsolation);

// Create order
router.post('/', machineOrderController.createOrder);

// Verify payment
router.post('/verify-payment', paymentLimiter, machineOrderController.verifyPayment);

// Complete mock payment for pending order (studio admin only)
router.post('/:id/mock-complete', checkRole('STUDIO_ADMIN', 'STUDIO_OWNER', 'studio_admin', 'studio_owner'), machineOrderController.mockCompletePayment);

// Get orders
router.get('/', machineOrderController.getOrders);

// Cancel order (only PENDING_PAYMENT orders)
router.delete('/:id', machineOrderController.cancelOrder);

export default router;
