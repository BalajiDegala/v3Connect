import { Router } from 'express';
import { protect, extractUserInfo, checkRole } from '../middleware/keycloak.js';
import { tenantIsolation } from '../middleware/index.js';
import { prisma } from '../config/database.js';

const router = Router();

// All routes require authentication
router.use(protect);
router.use(extractUserInfo);

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const keycloakId = req.user?.id;
    
    if (!keycloakId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user = await prisma.user.findFirst({
      where: { keycloakId },
      include: { organization: true },
    });

    // If user doesn't exist in our DB yet, create them
    if (!user) {
      // Check if they have an organization from Keycloak claims
      const orgId = req.user?.organizationId;
      
      user = await prisma.user.create({
        data: {
          keycloakId,
          email: req.user?.email || '',
          firstName: req.user?.name?.split(' ')[0] || '',
          lastName: req.user?.name?.split(' ').slice(1).join(' ') || '',
          role: req.user?.roles?.includes('admin') ? 'SUPER_ADMIN' 
              : req.user?.roles?.includes('studio_owner') ? 'STUDIO_ADMIN'
              : req.user?.roles?.includes('studio_admin') ? 'STUDIO_MANAGER'
              : 'STUDIO_USER',
          organizationId: orgId || undefined,
        },
        include: { organization: true },
      });
    }

    res.json({
      id: user.id,
      keycloakId: user.keycloakId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      organization: user.organization,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update current user profile
router.put('/me', async (req, res) => {
  try {
    const keycloakId = req.user?.id;
    const { firstName, lastName, phone, avatar } = req.body;

    const user = await prisma.user.update({
      where: { keycloakId },
      data: {
        firstName,
        lastName,
        phone,
        avatar,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// List users in organization (for studio admins) or all users (for platform admins)
router.get('/', tenantIsolation, checkRole('studio_owner', 'studio_admin', 'admin'), async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const roles = req.user?.roles || [];
    const isPlatformAdmin = roles.includes('admin') || roles.includes('realm-admin');

    // Platform admins see all users, studio admins see only their org's users
    const whereClause = isPlatformAdmin ? {} : organizationId ? { organizationId } : null;

    if (whereClause === null) {
      return res.status(400).json({ error: 'No organization associated with user' });
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        organization: isPlatformAdmin ? {
          select: {
            id: true,
            name: true,
          },
        } : false,
        showAssignments: {
          select: {
            id: true,
            role: true,
            department: true,
            show: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
              },
            },
          },
        },
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Invite user to organization
router.post('/invite', tenantIsolation, checkRole('studio_owner', 'studio_admin'), async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const { email, role } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'No organization associated' });
    }

    // Create invitation record
    const invitation = await prisma.invitation.create({
      data: {
        email,
        role: role || 'STUDIO_USER',
        organizationId,
        invitedById: req.user?.id || '',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // TODO: Send invitation email via Keycloak or custom email service

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation,
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Remove user from organization
router.delete('/:userId', tenantIsolation, checkRole('studio_owner', 'studio_admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const organizationId = req.user?.organizationId;

    // Verify user belongs to the same organization
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found in organization' });
    }

    // Soft delete - deactivate user
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE' },
    });

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

export default router;
