import { Router } from 'express';
import { machineController } from '../controllers/machineController.js';
import { protect, extractUserInfo, checkRole } from '../middleware/keycloak.js';
import { tenantIsolation, paymentLimiter } from '../middleware/index.js';

const router = Router();

// Public endpoint - no auth required (for quote page)
router.get('/catalog', machineController.getMachineConfigs);

// Protected routes require authentication
router.use(protect, extractUserInfo, tenantIsolation);

// Get machines
router.get('/', machineController.getMachines);

// Get machine configs (catalog) - authenticated version
router.get('/configs', machineController.getMachineConfigs);

// Get users in organization
router.get('/users', machineController.getUsers);

// Extend machine subscription - studio admin only
router.post('/:id/extend', checkRole('STUDIO_ADMIN', 'STUDIO_OWNER', 'studio_admin', 'studio_owner'), machineController.createExtensionOrder);
router.post('/:id/extend/verify', paymentLimiter, checkRole('STUDIO_ADMIN', 'STUDIO_OWNER', 'studio_admin', 'studio_owner'), machineController.verifyExtensionPayment);

// Assign/Unassign - studio admin only
router.post('/assign', checkRole('STUDIO_ADMIN', 'STUDIO_OWNER', 'studio_admin', 'studio_owner'), machineController.assignMachine);
router.post('/:id/unassign', checkRole('STUDIO_ADMIN', 'STUDIO_OWNER', 'studio_admin', 'studio_owner'), machineController.unassignMachine);

export default router;
