import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { protect, extractUserInfo, checkRole } from '../middleware/keycloak.js';
import { prisma } from '../config/database.js';

const router = Router();

// All routes require authentication and admin role
router.use(protect, extractUserInfo, checkRole('SUPER_ADMIN', 'admin', 'realm-admin'));

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [
      orgStats,
      userStats,
      machineStats,
      ticketStats,
      orderStats,
    ] = await Promise.all([
      // Organizations
      prisma.organization.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Users
      prisma.user.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Machines
      prisma.machine.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Tickets
      prisma.ticket.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Orders
      prisma.machineOrder.aggregate({
        _count: true,
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    // Process organization stats
    const organizations = {
      total: orgStats.reduce((sum, s) => sum + s._count, 0),
      active: orgStats.find(s => s.status === 'ACTIVE')?._count || 0,
      suspended: orgStats.find(s => s.status === 'SUSPENDED')?._count || 0,
    };

    // Process user stats
    const users = {
      total: userStats.reduce((sum, s) => sum + s._count, 0),
      active: userStats.find(s => s.status === 'ACTIVE')?._count || 0,
      pending: userStats.find(s => s.status === 'PENDING')?._count || 0,
    };

    // Process machine stats
    const machines = {
      total: machineStats.reduce((sum, s) => sum + s._count, 0),
      running: machineStats.find(s => s.status === 'RUNNING')?._count || 0,
      active: machineStats.find(s => s.status === 'ACTIVE')?._count || 0,
      expired: machineStats.find(s => s.status === 'EXPIRED')?._count || 0,
    };

    // Process ticket stats
    const tickets = {
      total: ticketStats.reduce((sum, s) => sum + s._count, 0),
      open: ticketStats.find(s => s.status === 'OPEN')?._count || 0,
      inProgress: ticketStats.find(s => s.status === 'IN_PROGRESS')?._count || 0,
      closed: (ticketStats.find(s => s.status === 'CLOSED')?._count || 0) + 
              (ticketStats.find(s => s.status === 'RESOLVED')?._count || 0),
    };

    // Process order stats
    const paidOrders = await prisma.machineOrder.count({
      where: { status: 'PAID' },
    });
    const pendingOrders = await prisma.machineOrder.count({
      where: { status: 'PENDING_PAYMENT' },
    });

    const orders = {
      total: orderStats._count || 0,
      pending: pendingOrders,
      completed: paidOrders,
      totalRevenue: Number(orderStats._sum?.totalAmount || 0),
    };

    res.json({
      organizations,
      users,
      machines,
      tickets,
      orders,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// List all organizations
router.get('/organizations', async (req, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            machines: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get organization details
router.get('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            users: true,
            machines: true,
            invoices: true,
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

// Suspend organization
router.post('/organizations/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.organization.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    res.json({ message: 'Organization suspended' });
  } catch (error) {
    console.error('Error suspending organization:', error);
    res.status(500).json({ error: 'Failed to suspend organization' });
  }
});

// Activate organization
router.post('/organizations/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.organization.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    res.json({ message: 'Organization activated' });
  } catch (error) {
    console.error('Error activating organization:', error);
    res.status(500).json({ error: 'Failed to activate organization' });
  }
});

// Get all users across all organizations (Platform Admin only)
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        organization: {
          select: { id: true, name: true },
        },
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
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Delete user (Platform Admin only)
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { permanent } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (permanent === 'true') {
      // Permanently delete user
      await prisma.user.delete({
        where: { id: userId },
      });
      res.json({ message: 'User permanently deleted' });
    } else {
      // Soft delete - set status to INACTIVE
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'INACTIVE' },
      });
      res.json({ message: 'User deactivated' });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get all shows across all organizations (Platform Admin only)
router.get('/shows', async (req, res) => {
  try {
    const db = prisma as any;
    const shows = await db.show.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        machineAssignments: {
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignments: true,
            machineAssignments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(shows);
  } catch (error) {
    console.error('Error fetching all shows:', error);
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

// Ticket management - get all tickets
router.get('/tickets', async (req, res) => {
  try {
    const { limit } = req.query;

    const tickets = await prisma.ticket.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : undefined,
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get ticket details
router.get('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Respond to ticket (admin) - For now, just update the ticket description/notes
router.post('/tickets/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    // Update ticket status to IN_PROGRESS if it was OPEN
    await prisma.ticket.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
        specialRequirements: message, // Store admin response in specialRequirements for now
      },
    });

    res.json({ message: 'Response added' });
  } catch (error) {
    console.error('Error responding to ticket:', error);
    res.status(500).json({ error: 'Failed to respond to ticket' });
  }
});

// Bulk update ticket status (must come before :id route)
router.put('/tickets/bulk/status', async (req, res) => {
  try {
    const { ticketIds, status } = req.body;

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ error: 'Invalid ticket IDs' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    await prisma.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status },
    });

    res.json({ message: `${ticketIds.length} ticket(s) updated`, count: ticketIds.length });
  } catch (error) {
    console.error('Error bulk updating ticket status:', error);
    res.status(500).json({ error: 'Failed to update tickets' });
  }
});

// Update single ticket status
router.put('/tickets/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await prisma.ticket.update({
      where: { id },
      data: { status },
    });

    res.json({ message: 'Status updated' });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.patch('/tickets/:ticketId', adminController.updateTicket);

// Machine provisioning
router.post('/machines/provision', adminController.provisionMachine);
router.post('/machines/assign', adminController.assignMachine);
router.post('/machines/:id/unassign', adminController.unassignMachine);
router.get('/machines', adminController.getAllMachines);

// List all orders
router.get('/orders', async (req, res) => {
  try {
    const { limit, status } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const orders = await prisma.machineOrder.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
          },
        },
        machineConfig: true,
        machines: {
          include: {
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
              where: {
                unassignedAt: null,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : undefined,
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get all invoices across all organizations (Platform Admin only)
router.get('/invoices', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        organization: {
          select: { id: true, name: true },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

export default router;
