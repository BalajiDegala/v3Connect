import { Router, Request, Response } from 'express';
import { keycloak } from '../middleware/keycloak.js';
import { prisma } from '../config/database.js';

const router = Router();

// Cast prisma to any to avoid TypeScript errors until VS Code reloads the Prisma client types
// The models are correctly defined in the schema and will work at runtime
const db = prisma as any;

// Get all shows for the authenticated user's organization (or all shows for platform admins)
router.get('/', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const keycloakId = (req as any).kauth?.grant?.access_token?.content?.sub;
    const roles = (req as any).kauth?.grant?.access_token?.content?.realm_access?.roles || [];
    const isPlatformAdmin = roles.includes('admin') || roles.includes('realm-admin');
    
    console.log('Shows API - keycloakId:', keycloakId, 'roles:', roles, 'isPlatformAdmin:', isPlatformAdmin);
    
    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { keycloakId },
      include: { organization: true },
    });

    console.log('Shows API - user:', user?.id, 'organizationId:', user?.organizationId);

    // Build where clause based on user role
    const whereClause = isPlatformAdmin ? {} : { organizationId: user?.organizationId };
    
    // If regular user without org, return 403
    if (!isPlatformAdmin && !user?.organizationId) {
      return res.status(403).json({ error: 'User must belong to an organization' });
    }

    // Fetch shows with includes
    const shows = await db.show.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
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

    console.log('Shows API - returning', shows.length, 'shows');
    res.json(shows);
  } catch (error: any) {
    console.error('Error fetching shows:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch shows', details: error.message });
  }
});

// Get single show with details
router.get('/:id', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const keycloakId = (req as any).kauth?.grant?.access_token?.content?.sub;
    
    const user = await prisma.user.findUnique({
      where: { keycloakId },
    });

    const show = await db.show.findUnique({
      where: { id },
      include: {
        organization: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                role: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
        machineAssignments: {
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                status: true,
                machineConfig: true,
              },
            },
          },
        },
      },
    });

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Check if user has access to this show's organization
    if (user?.organizationId !== show.organizationId) {
      // Check if user is admin
      const roles = (req as any).kauth?.grant?.access_token?.content?.realm_access?.roles || [];
      if (!roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(show);
  } catch (error) {
    console.error('Error fetching show:', error);
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

// Create a new show
router.post('/', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const keycloakId = (req as any).kauth?.grant?.access_token?.content?.sub;
    const { name, code, description, startDate, endDate } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { keycloakId },
      include: { organization: true },
    });

    if (!user?.organizationId) {
      return res.status(403).json({ error: 'User must belong to an organization' });
    }

    // Check if user has permission (studio_owner, studio_admin, or admin)
    const roles = (req as any).kauth?.grant?.access_token?.content?.realm_access?.roles || [];
    const hasPermission = roles.some((r: string) => 
      ['admin', 'studio_owner', 'studio_admin'].includes(r)
    ) || user.role === 'STUDIO_ADMIN' || user.role === 'STUDIO_MANAGER';

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions to create shows' });
    }

    // Check if code is unique within organization
    const existingShow = await db.show.findUnique({
      where: {
        organizationId_code: {
          organizationId: user.organizationId,
          code: code.toUpperCase(),
        },
      },
    });

    if (existingShow) {
      return res.status(400).json({ error: 'Show code already exists in this organization' });
    }

    const show = await db.show.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        organizationId: user.organizationId,
      },
      include: {
        _count: {
          select: {
            assignments: true,
            machineAssignments: true,
          },
        },
      },
    });

    res.status(201).json(show);
  } catch (error) {
    console.error('Error creating show:', error);
    res.status(500).json({ error: 'Failed to create show' });
  }
});

// Update a show
router.put('/:id', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const keycloakId = (req as any).kauth?.grant?.access_token?.content?.sub;
    const { name, code, description, status, startDate, endDate } = req.body;

    const user = await prisma.user.findUnique({
      where: { keycloakId },
    });

    const show = await db.show.findUnique({
      where: { id },
    });

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Check permissions
    if (user?.organizationId !== show.organizationId) {
      const roles = (req as any).kauth?.grant?.access_token?.content?.realm_access?.roles || [];
      if (!roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // If code is being changed, check uniqueness
    if (code && code.toUpperCase() !== show.code) {
      const existingShow = await db.show.findUnique({
        where: {
          organizationId_code: {
            organizationId: show.organizationId,
            code: code.toUpperCase(),
          },
        },
      });

      if (existingShow) {
        return res.status(400).json({ error: 'Show code already exists' });
      }
    }

    const updatedShow = await db.show.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
      include: {
        _count: {
          select: {
            assignments: true,
            machineAssignments: true,
          },
        },
      },
    });

    res.json(updatedShow);
  } catch (error) {
    console.error('Error updating show:', error);
    res.status(500).json({ error: 'Failed to update show' });
  }
});

// Delete a show
router.delete('/:id', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const keycloakId = (req as any).kauth?.grant?.access_token?.content?.sub;

    const user = await prisma.user.findUnique({
      where: { keycloakId },
    });

    const show = await db.show.findUnique({
      where: { id },
    });

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Check permissions
    if (user?.organizationId !== show.organizationId) {
      const roles = (req as any).kauth?.grant?.access_token?.content?.realm_access?.roles || [];
      if (!roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await db.show.delete({
      where: { id },
    });

    res.json({ message: 'Show deleted successfully' });
  } catch (error) {
    console.error('Error deleting show:', error);
    res.status(500).json({ error: 'Failed to delete show' });
  }
});

// Assign user to show
router.post('/:id/assign', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, role, department } = req.body;
    const keycloakId = (req as any).kauth?.grant?.access_token?.content?.sub;

    if (!userId || !role) {
      return res.status(400).json({ error: 'User ID and role are required' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { keycloakId },
    });

    const show = await db.show.findUnique({
      where: { id },
    });

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Check if the user to assign belongs to the same organization
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.organizationId !== show.organizationId) {
      return res.status(400).json({ error: 'User must belong to the same organization as the show' });
    }

    // Check if already assigned
    const existingAssignment = await db.showAssignment.findUnique({
      where: {
        showId_userId: {
          showId: id,
          userId,
        },
      },
    });

    if (existingAssignment) {
      // Update existing assignment
      const updated = await db.showAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          role,
          department,
          unassignedAt: null,
        },
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
      });
      return res.json(updated);
    }

    const assignment = await db.showAssignment.create({
      data: {
        showId: id,
        userId,
        role,
        department,
      },
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
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning user to show:', error);
    res.status(500).json({ error: 'Failed to assign user to show' });
  }
});

// Update user's role in show
router.put('/:id/assign/:assignmentId', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id, assignmentId } = req.params;
    const { role, department } = req.body;

    const assignment = await db.showAssignment.findUnique({
      where: { id: assignmentId },
      include: { show: true },
    });

    if (!assignment || assignment.showId !== id) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const updated = await db.showAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(role && { role }),
        ...(department !== undefined && { department }),
      },
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
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Remove user from show
router.delete('/:id/assign/:userId', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;

    const assignment = await db.showAssignment.findUnique({
      where: {
        showId_userId: {
          showId: id,
          userId,
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await db.showAssignment.delete({
      where: { id: assignment.id },
    });

    res.json({ message: 'User removed from show' });
  } catch (error) {
    console.error('Error removing user from show:', error);
    res.status(500).json({ error: 'Failed to remove user from show' });
  }
});

// Assign machine to show
router.post('/:id/machines', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { machineId } = req.body;

    if (!machineId) {
      return res.status(400).json({ error: 'Machine ID is required' });
    }

    const show = await db.show.findUnique({
      where: { id },
    });

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    if (machine.organizationId !== show.organizationId) {
      return res.status(400).json({ error: 'Machine must belong to the same organization as the show' });
    }

    // Check if already assigned
    const existing = await db.machineShowAssignment.findUnique({
      where: {
        machineId_showId: {
          machineId,
          showId: id,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Machine is already assigned to this show' });
    }

    const assignment = await db.machineShowAssignment.create({
      data: {
        machineId,
        showId: id,
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            status: true,
            machineConfig: true,
          },
        },
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning machine to show:', error);
    res.status(500).json({ error: 'Failed to assign machine to show' });
  }
});

// Remove machine from show
router.delete('/:id/machines/:machineId', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id, machineId } = req.params;

    const assignment = await db.machineShowAssignment.findUnique({
      where: {
        machineId_showId: {
          machineId,
          showId: id,
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await db.machineShowAssignment.delete({
      where: { id: assignment.id },
    });

    res.json({ message: 'Machine removed from show' });
  } catch (error) {
    console.error('Error removing machine from show:', error);
    res.status(500).json({ error: 'Failed to remove machine from show' });
  }
});

// Get machines for a specific user in a show
router.get('/:id/machines', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    const show = await db.show.findUnique({
      where: { id },
    });

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // If userId is provided, get all machines assigned to that user (not just show-specific)
    if (userId) {
      // Get all machines assigned to this user
      const userMachines = await db.machine.findMany({
        where: {
          assignments: {
            some: {
              userId: userId as string,
              unassignedAt: null, // Only active assignments
            },
          },
        },
        include: {
          assignments: {
            where: { 
              userId: userId as string,
              unassignedAt: null,
            },
          },
          showAssignments: {
            include: {
              show: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      });

      // Map to include show information
      const machines = userMachines.map((machine: any) => ({
        id: machine.id,
        name: machine.name,
        status: machine.status,
        expiryDate: machine.expiryDate,
        startDate: machine.startDate,
        task: machine.assignments[0]?.task || null,
        assignedAt: machine.assignments[0]?.assignedAt,
        assignedShow: machine.showAssignments?.[0]?.show || null,
      }));

      return res.json(machines);
    }

    // Otherwise, get all machines in the show
    const machineAssignments = await db.machineShowAssignment.findMany({
      where: { showId: id },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            status: true,
            machineConfig: true,
          },
        },
      },
    });

    res.json(machineAssignments);
  } catch (error) {
    console.error('Error fetching show machines:', error);
    res.status(500).json({ error: 'Failed to fetch show machines' });
  }
});

// Get user's show assignments
router.get('/user/:userId/assignments', keycloak.protect(), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const assignments = await db.showAssignment.findMany({
      where: { userId },
      include: {
        show: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching user assignments:', error);
    res.status(500).json({ error: 'Failed to fetch user assignments' });
  }
});

export default router;
