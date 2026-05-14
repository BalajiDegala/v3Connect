import { Router } from 'express';
import { protect, extractUserInfo, checkRole } from '../middleware/keycloak.js';
import { prisma } from '../config/database.js';
import { emailService } from '../services/emailService.js';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';

const router = Router();

function toUserRole(role: string): UserRole {
  const normalized = role?.toUpperCase();
  if (
    normalized === 'SUPER_ADMIN' ||
    normalized === 'STUDIO_ADMIN' ||
    normalized === 'STUDIO_MANAGER' ||
    normalized === 'STUDIO_USER' ||
    normalized === 'USER'
  ) {
    return normalized;
  }
  return 'STUDIO_USER';
}

// Get invitation by token (public - for accepting invitations)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.invitation.findFirst({
      where: { 
        token,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: true,
        invitedBy: true,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    res.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      invitedBy: invitation.invitedBy?.firstName 
        ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`
        : invitation.invitedBy?.email || 'Admin',
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
});

// Accept invitation (authenticated)
router.post('/:token/accept', protect, extractUserInfo, async (req, res) => {
  try {
    const { token } = req.params;
    const keycloakId = req.user?.id;
    const userEmail = req.user?.email;

    const invitation = await prisma.invitation.findFirst({
      where: { 
        token,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Check if email matches (optional - can be relaxed)
    if (invitation.email.toLowerCase() !== userEmail?.toLowerCase()) {
      return res.status(400).json({ 
        error: 'Email mismatch. Please register with the email address the invitation was sent to.' 
      });
    }

    // Check if user already exists in this organization
    const existingUser = await prisma.user.findFirst({
      where: { 
        keycloakId,
        organizationId: invitation.organizationId,
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'You are already a member of this organization' });
    }

    // Create or update user and link to organization
    const user = await prisma.user.upsert({
      where: { keycloakId: keycloakId! },
      update: {
        organizationId: invitation.organizationId,
        role: toUserRole(invitation.role),
        status: 'ACTIVE',
      },
      create: {
        keycloakId: keycloakId!,
        email: userEmail || invitation.email,
        firstName: req.user?.name?.split(' ')[0] || '',
        lastName: req.user?.name?.split(' ').slice(1).join(' ') || '',
        organizationId: invitation.organizationId,
        role: toUserRole(invitation.role),
        status: 'ACTIVE',
      },
    });

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedByUserId: user.id,
      },
    });

    res.json({
      message: 'Invitation accepted successfully',
      organization: invitation.organization.name,
      role: invitation.role,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Create invitation (org admin only)
router.post('/', protect, extractUserInfo, checkRole('studio_owner', 'studio_admin', 'admin'), async (req, res) => {
  try {
    const { email, role = 'STUDIO_USER', firstName, lastName } = req.body;
    const keycloakId = req.user?.id;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get the inviting user and their organization
    const invitingUser = await prisma.user.findFirst({
      where: { keycloakId },
      include: { organization: true },
    });

    if (!invitingUser?.organizationId) {
      return res.status(400).json({ error: 'You must belong to an organization to invite users' });
    }

    // Check if user is already in the organization
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId: invitingUser.organizationId,
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists in your organization' });
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId: invitingUser.organizationId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return res.status(400).json({ error: 'An invitation is already pending for this email' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase(),
        token,
        role,
        organizationId: invitingUser.organizationId,
        invitedById: invitingUser.id,
        status: 'PENDING',
        expiresAt,
        metadata: firstName || lastName ? JSON.stringify({ firstName, lastName }) : null,
      },
      include: {
        organization: true,
      },
    });

    // Send invitation email
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/accept?token=${token}`;
    
    try {
      await emailService.sendInvitationEmail(
        email,
        invitation.organization.name,
        `${invitingUser.firstName} ${invitingUser.lastName}`,
        inviteUrl
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the request, just log it
    }

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteUrl, // For testing/debugging
      },
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// List invitations for organization
router.get('/', protect, extractUserInfo, checkRole('studio_owner', 'studio_admin', 'admin'), async (req, res) => {
  try {
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'No organization found' });
    }

    const invitations = await prisma.invitation.findMany({
      where: { organizationId: user.organizationId },
      include: {
        invitedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invitations);
  } catch (error) {
    console.error('Error listing invitations:', error);
    res.status(500).json({ error: 'Failed to list invitations' });
  }
});

// Resend invitation
router.post('/:id/resend', protect, extractUserInfo, checkRole('studio_owner', 'studio_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
      include: { organization: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'No organization found' });
    }

    const invitation = await prisma.invitation.findFirst({
      where: { 
        id,
        organizationId: user.organizationId,
        status: 'PENDING',
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found or already accepted' });
    }

    // Generate new token and extend expiry
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.invitation.update({
      where: { id },
      data: { 
        token: newToken,
        expiresAt: newExpiry,
      },
    });

    // Send email
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/accept?token=${newToken}`;
    
    try {
      await emailService.sendInvitationEmail(
        invitation.email,
        user.organization!.name,
        `${user.firstName} ${user.lastName}`,
        inviteUrl
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
    }

    res.json({ message: 'Invitation resent successfully' });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// Revoke invitation
router.delete('/:id', protect, extractUserInfo, checkRole('studio_owner', 'studio_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'No organization found' });
    }

    const invitation = await prisma.invitation.findFirst({
      where: { 
        id,
        organizationId: user.organizationId,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    await prisma.invitation.update({
      where: { id },
      data: { status: 'REVOKED' },
    });

    res.json({ message: 'Invitation revoked' });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

// Permanently delete cancelled/revoked invitation
router.delete('/:id/permanent', protect, extractUserInfo, checkRole('studio_owner', 'studio_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'No organization found' });
    }

    // First check if invitation exists
    const existingInvitation = await prisma.invitation.findUnique({
      where: { id },
    });

    if (!existingInvitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if invitation belongs to user's organization
    if (existingInvitation.organizationId !== user.organizationId) {
      return res.status(403).json({ error: 'Not authorized to delete this invitation' });
    }

    // Check if invitation can be permanently deleted
    if (!['REVOKED', 'CANCELLED', 'EXPIRED'].includes(existingInvitation.status)) {
      return res.status(400).json({ 
        error: `Cannot permanently delete invitation with status: ${existingInvitation.status}. Only REVOKED, CANCELLED, or EXPIRED invitations can be permanently deleted.` 
      });
    }

    await prisma.invitation.delete({
      where: { id },
    });

    res.json({ message: 'Invitation deleted permanently' });
  } catch (error) {
    console.error('Error deleting invitation:', error);
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

export default router;
