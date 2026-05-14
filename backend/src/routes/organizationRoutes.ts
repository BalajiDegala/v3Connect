import { Router } from 'express';
import { protect, extractUserInfo, checkRole } from '../middleware/keycloak.js';
import { prisma } from '../config/database.js';
import { keycloakAdminService } from '../services/keycloakAdminService.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

// Get current user's organization
router.get('/me', protect, extractUserInfo, async (req, res) => {
  try {
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
      include: { organization: true },
    });

    if (!user?.organization) {
      return res.status(404).json({ error: 'No organization found' });
    }

    res.json(user.organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Create organization (during registration)
router.post('/', protect, extractUserInfo, async (req, res) => {
  try {
    const keycloakId = req.user?.id;
    const { name, contactEmail, contactPhone, domain, gstNumber, address } = req.body;

    if (!name || !contactEmail) {
      return res.status(400).json({ error: 'Name and contact email are required' });
    }

    // Check if user already has an organization.
    // Treat as idempotent success to handle duplicate submits/retries gracefully.
    const existingUser = await prisma.user.findFirst({
      where: { keycloakId },
      include: { organization: true },
    });

    if (existingUser?.organizationId) {
      return res.status(200).json(existingUser.organization);
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name,
        contactEmail,
        contactPhone,
        domain,
        gstNumber,
        address,
        keycloakOrgId: `org-${crypto.randomUUID()}`,
      },
    });

    // Link user to organization in an idempotent way.
    // This avoids unique-key races when /users/me and /organizations run concurrently.
    await prisma.user.upsert({
      where: { keycloakId: keycloakId! },
      update: {
        organizationId: organization.id,
        role: 'STUDIO_ADMIN',
      },
      create: {
        keycloakId: keycloakId!,
        email: req.user?.email || contactEmail,
        firstName: req.user?.name?.split(' ')[0] || '',
        lastName: req.user?.name?.split(' ').slice(1).join(' ') || '',
        role: 'STUDIO_ADMIN',
        status: 'ACTIVE',
        organizationId: organization.id,
      },
    });

    // Optional Keycloak sync (disabled by default in Supabase-auth mode)
    if (process.env.ENABLE_KEYCLOAK_ADMIN === 'true') {
      try {
        await keycloakAdminService.assignRoleToUser(keycloakId!, 'studio_owner');
        console.log(`Assigned studio_owner role to user ${keycloakId}`);
      } catch (roleError) {
        console.error('Failed to assign Keycloak role:', roleError);
      }
    }

    // Supabase-auth mode: assign only studio owner role for studio creators.
    // Single-role policy avoids owner/user view ambiguity.
    if (supabaseAdmin && keycloakId) {
      try {
        const existing = await supabaseAdmin.auth.admin.getUserById(keycloakId);
        const existingRoles = Array.isArray(existing.data.user?.app_metadata?.roles)
          ? existing.data.user?.app_metadata?.roles
          : [];
        const baseRoles = existingRoles.filter(
          (role) => !['studio_owner', 'studio_admin', 'studio_user'].includes(String(role).toLowerCase())
        );
        const mergedRoles = [...new Set([...baseRoles, 'studio_owner'])];

        await supabaseAdmin.auth.admin.updateUserById(keycloakId, {
          app_metadata: {
            ...(existing.data.user?.app_metadata || {}),
            roles: mergedRoles,
          },
        });
      } catch (supabaseRoleError) {
        console.error('Failed to update Supabase roles:', supabaseRoleError);
      }
    }

    res.status(201).json(organization);
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Update organization
router.put('/:id', protect, extractUserInfo, checkRole('studio_owner', 'studio_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactEmail, contactPhone, domain, gstNumber, address, billingEmail } = req.body;

    // Verify user belongs to this organization (unless admin)
    if (!req.user?.roles?.includes('admin')) {
      const user = await prisma.user.findFirst({
        where: { keycloakId: req.user?.id },
      });

      if (user?.organizationId !== id) {
        return res.status(403).json({ error: 'Cannot update another organization' });
      }
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        name,
        contactEmail,
        contactPhone,
        domain,
        gstNumber,
        address,
        billingEmail,
      },
    });

    res.json(organization);
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Get organization by ID (admin only)
router.get('/:id', protect, extractUserInfo, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            machineOrders: true,
            machines: true,
          },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// List all organizations (admin only)
router.get('/', protect, extractUserInfo, checkRole('admin'), async (req, res) => {
  try {
    const { status, subscription, page = 1, limit = 20 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (subscription) where.subscription = subscription;

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              machineOrders: true,
            },
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.count({ where }),
    ]);

    res.json({
      data: organizations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error listing organizations:', error);
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

export default router;
