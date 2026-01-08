import { Router, Request, Response } from 'express';
import { protect, extractUserInfo } from '../middleware/keycloak.js';
import { prisma } from '../config/database.js';

const router = Router();

// All routes require authentication
router.use(protect, extractUserInfo);

// Get tickets for user (based on role)
// - Studio Admin: all tickets from their organization
// - Regular User: only tickets from their organization (for now)
router.get('/', async (req: Request, res: Response) => {
  try {
    const keycloakId = req.user?.id;
    const roles = req.user?.roles || [];

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Filter tickets based on role:
    // - Admin: all tickets
    // - Studio Owner/Admin: all tickets from their organization
    // - Regular User: only support tickets (no machineConfigId) from their organization
    const isAdmin = roles.includes('admin');
    const isStudioAdmin = roles.includes('studio_owner') || roles.includes('studio_admin');
    
    const whereClause: any = {
      organizationId: user.organizationId!,
    };
    
    // Regular users can only see support tickets, not machine request tickets
    if (!isAdmin && !isStudioAdmin) {
      whereClause.machineConfigId = null;
    }
    
    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get single ticket
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check access: user must be in the same organization
    if (ticket.organizationId !== user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create a new ticket
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, subject, description, priority = 'MEDIUM' } = req.body;
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user || !user.organizationId) {
      return res.status(404).json({ error: 'User or organization not found' });
    }

    // Generate ticket number
    const ticketCount = await prisma.ticket.count();
    const ticketNumber = `TKT-${String(ticketCount + 1).padStart(5, '0')}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        organizationId: user.organizationId,
        title: title || subject, // Support both title and subject
        description,
        priority,
        status: 'OPEN',
      },
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Close ticket (by user)
router.put('/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket || ticket.organizationId !== user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.ticket.update({
      where: { id },
      data: { status: 'CLOSED', resolvedAt: new Date() },
    });

    res.json({ message: 'Ticket closed' });
  } catch (error) {
    console.error('Error closing ticket:', error);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
});

export default router;
