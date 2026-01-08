import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { emailService } from '../services/emailService.js';
import { paymentService } from '../services/paymentService.js';

export const machineController = {
  // Get machines for organization (or all machines for platform admins)
  async getMachines(req: Request, res: Response) {
    try {
      const organizationId = req.organizationId;
      const roles = (req as any).user?.roles || [];
      const isPlatformAdmin = roles.includes('admin') || roles.includes('realm-admin');
      const { status } = req.query;

      // Platform admins can see all machines
      const where: any = isPlatformAdmin ? {} : { organizationId };
      if (status) where.status = status;

      // If not admin and no org, return error
      if (!isPlatformAdmin && !organizationId) {
        return res.status(403).json({ error: 'User must belong to an organization' });
      }

      const machines = await prisma.machine.findMany({
        where,
        include: {
          machineConfig: true,
          organization: isPlatformAdmin ? {
            select: {
              id: true,
              name: true,
            },
          } : false,
          assignments: {
            include: {
              user: true,
            },
            where: {
              unassignedAt: null, // Only active assignments
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
        orderBy: { createdAt: 'desc' },
      });

      // Transform to include show in assignments for frontend compatibility
      const machinesWithShow = machines.map((machine: any) => ({
        ...machine,
        assignments: machine.assignments.map((assignment: any) => ({
          ...assignment,
          show: machine.showAssignments?.[0]?.show || null,
        })),
      }));

      res.json(machinesWithShow);
    } catch (error: any) {
      console.error('Get machines error:', error);
      res.status(500).json({ error: 'Failed to fetch machines', details: error.message });
    }
  },

  // Get machine configurations (catalog)
  async getMachineConfigs(req: Request, res: Response) {
    try {
      const configs = await prisma.machineConfig.findMany({
        where: { isActive: true },
        orderBy: { pricePerMonth: 'asc' },
      });

      res.json(configs);
    } catch (error: any) {
      console.error('Get machine configs error:', error);
      res.status(500).json({ error: 'Failed to fetch machine configurations', details: error.message });
    }
  },

  // Get users in organization
  async getUsers(req: Request, res: Response) {
    try {
      const organizationId = req.organizationId!;

      const users = await prisma.user.findMany({
        where: { organizationId },
        include: {
          assignedMachines: {
            where: {
              unassignedAt: null,
            },
            include: {
              machine: {
                include: {
                  machineConfig: true,
                },
              },
            },
          },
        },
        orderBy: { firstName: 'asc' },
      });

      res.json(users);
    } catch (error: any) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
  },

  // Assign machine to user (for studio admins)
  async assignMachine(req: Request, res: Response) {
    try {
      const organizationId = req.organizationId!;
      const { machineId, userId, task, showId } = req.body;

      // Verify machine belongs to organization
      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        include: { machineConfig: true },
      });

      if (!machine || machine.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      // Verify user belongs to organization
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.organizationId !== organizationId) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if machine is already assigned
      const existingAssignment = await prisma.machineAssignment.findFirst({
        where: { machineId, unassignedAt: null },
      });

      if (existingAssignment) {
        return res.status(400).json({ error: 'Machine is already assigned' });
      }

      // Create assignment
      const assignment = await prisma.machineAssignment.create({
        data: {
          machineId,
          userId,
          task,
        },
        include: {
          machine: true,
          user: true,
        },
      });

      // Update machine status to RUNNING
      await prisma.machine.update({
        where: { id: machineId },
        data: { status: 'RUNNING' },
      });

      // Send notification email to user
      try {
        await emailService.sendMachineAssignedEmail(
          user.email,
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          machine.name,
          `${machine.machineConfig.name} (${machine.machineConfig.cpu}, ${machine.machineConfig.ram})`,
          machine.dcvLink!,
          task || undefined
        );
        
        await prisma.machineAssignment.update({
          where: { id: assignment.id },
          data: { emailSent: true, emailSentAt: new Date() },
        });
      } catch (emailError) {
        console.error('Failed to send assignment email:', emailError);
      }

      res.json({
        success: true,
        assignment,
        message: 'Machine assigned successfully',
      });
    } catch (error: any) {
      console.error('Assign machine error:', error);
      res.status(500).json({ error: 'Failed to assign machine', details: error.message });
    }
  },

  // Unassign machine from user (for studio admins)
  async unassignMachine(req: Request, res: Response) {
    try {
      const organizationId = req.organizationId!;
      const { id } = req.params;

      // Verify machine belongs to organization
      const machine = await prisma.machine.findUnique({
        where: { id },
        include: {
          assignments: {
            where: { unassignedAt: null },
            include: { user: true },
          },
        },
      });

      if (!machine || machine.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      const activeAssignment = machine.assignments[0];
      if (!activeAssignment) {
        return res.status(400).json({ error: 'Machine is not currently assigned' });
      }

      // Mark assignment as unassigned
      await prisma.machineAssignment.update({
        where: { id: activeAssignment.id },
        data: { unassignedAt: new Date() },
      });

      // Update machine status back to ACTIVE
      await prisma.machine.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });

      // Send notification email
      try {
        await emailService.sendMachineUnassignedEmail(
          activeAssignment.user.email,
          `${activeAssignment.user.firstName || ''} ${activeAssignment.user.lastName || ''}`.trim() || activeAssignment.user.email,
          machine.name
        );
      } catch (emailError) {
        console.error('Failed to send unassignment email:', emailError);
      }

      res.json({
        success: true,
        message: 'Machine unassigned successfully',
      });
    } catch (error: any) {
      console.error('Unassign machine error:', error);
      res.status(500).json({ error: 'Failed to unassign machine', details: error.message });
    }
  },

  // Create extension order for a machine
  async createExtensionOrder(req: Request, res: Response) {
    try {
      const organizationId = req.organizationId!;
      const { id } = req.params;
      const { duration } = req.body; // Duration in months

      if (!duration || duration < 1) {
        return res.status(400).json({ error: 'Duration must be at least 1 month' });
      }

      // Get machine with its config
      const machine = await prisma.machine.findUnique({
        where: { id },
        include: { 
          machineConfig: true,
          organization: true,
        },
      });

      if (!machine || machine.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      // Calculate total amount
      const monthlyPrice = Number(machine.machineConfig.pricePerMonth);
      const totalAmount = monthlyPrice * duration;

      // Generate order number with EXT prefix
      const orderNumber = `EXT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Create Razorpay order
      const razorpayOrder = await paymentService.createOrder(
        totalAmount,
        'INR',
        orderNumber
      );

      // Create extension order in database (using existing MachineOrder model)
      const order = await prisma.machineOrder.create({
        data: {
          orderNumber,
          organizationId,
          machineConfigId: machine.machineConfigId,
          quantity: 1, // Extension is always for 1 machine
          duration,
          totalAmount,
          razorpayOrderId: razorpayOrder.id,
          status: 'PENDING_PAYMENT',
        },
        include: {
          machineConfig: true,
          organization: true,
        },
      });

      res.status(201).json({
        order,
        machine: {
          id: machine.id,
          name: machine.name,
          currentExpiryDate: machine.expiryDate,
        },
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        },
      });
    } catch (error: any) {
      console.error('Create extension order error:', error);
      res.status(500).json({ error: 'Failed to create extension order', details: error.message });
    }
  },

  // Verify extension payment and extend machine
  async verifyExtensionPayment(req: Request, res: Response) {
    try {
      const organizationId = req.organizationId!;
      const { id: machineId } = req.params;
      const { orderId, paymentId, signature } = req.body;

      // Verify signature
      const isValid = paymentService.verifyPaymentSignature(
        orderId,
        paymentId,
        signature
      );

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      // Find order
      const order = await prisma.machineOrder.findFirst({
        where: { razorpayOrderId: orderId },
        include: {
          organization: true,
          machineConfig: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Get machine
      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          assignments: {
            where: { unassignedAt: null },
            include: { user: true },
          },
        },
      });

      if (!machine || machine.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      // Calculate new expiry date
      const currentExpiry = new Date(machine.expiryDate);
      const now = new Date();
      // If machine is already expired, extend from today; otherwise extend from current expiry
      const baseDate = currentExpiry < now ? now : currentExpiry;
      const newExpiryDate = new Date(baseDate);
      newExpiryDate.setMonth(newExpiryDate.getMonth() + order.duration);

      // Update order status
      await prisma.machineOrder.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETED',
          razorpayPaymentId: paymentId,
          paidAt: new Date(),
        },
      });

      // Update machine expiry date and status
      const newStatus = machine.status === 'EXPIRED' ? 'ACTIVE' : machine.status;
      await prisma.machine.update({
        where: { id: machineId },
        data: {
          expiryDate: newExpiryDate,
          status: newStatus,
        },
      });

      // Create invoice for the extension
      const invoiceNumber = `EXT-INV-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      const subtotal = Number(order.totalAmount);
      const gstRate = 0.18;
      const taxAmount = subtotal * gstRate;
      const totalWithTax = subtotal + taxAmount;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          organizationId: order.organizationId,
          amount: subtotal,
          taxAmount,
          totalAmount: totalWithTax,
          status: 'PAID',
          paidAt: new Date(),
          dueDate: new Date(), // Already paid, so due date is today
          items: {
            create: {
              description: `Machine Extension - ${machine.name} - ${order.duration} month(s)`,
              quantity: 1,
              unitPrice: subtotal,
              amount: subtotal,
            },
          },
        },
      });

      // Create ticket for tracking
      const ticketNumber = `EXT-TKT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          organizationId: order.organizationId,
          title: `Machine Extension - ${machine.name}`,
          description: `Machine ${machine.name} extended by ${order.duration} month(s). New expiry date: ${newExpiryDate.toLocaleDateString()}. Invoice: ${invoiceNumber}`,
          priority: 'LOW',
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });

      // Link ticket to order
      await prisma.machineOrder.update({
        where: { id: order.id },
        data: { ticketId: ticket.id },
      });

      // Send notification email to assigned user if any
      const assignedUser = machine.assignments[0]?.user;
      if (assignedUser) {
        try {
          await emailService.sendMachineExtendedEmail(
            assignedUser.email,
            `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email,
            machine.name,
            order.duration,
            newExpiryDate
          );
        } catch (emailError) {
          console.error('Failed to send extension email:', emailError);
        }
      }

      // Create notifications for admins
      try {
        const adminUsers = await prisma.user.findMany({
          where: { role: 'SUPER_ADMIN' },
        });

        for (const admin of adminUsers) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: 'Machine Extended',
              message: `${order.organization.name} extended ${machine.name} for ${order.duration} month(s). New expiry: ${newExpiryDate.toLocaleDateString()}`,
              type: 'MACHINE_REQUEST',
              entityType: 'machine',
              entityId: machine.id,
            },
          });
        }
      } catch (notifError) {
        console.error('Failed to create admin notifications:', notifError);
      }

      res.json({
        success: true,
        message: 'Machine extended successfully',
        machine: {
          id: machine.id,
          name: machine.name,
          previousExpiryDate: machine.expiryDate,
          newExpiryDate,
          status: newStatus,
        },
        ticketNumber,
        invoiceNumber,
      });
    } catch (error: any) {
      console.error('Verify extension payment error:', error);
      res.status(500).json({ error: 'Failed to verify extension payment', details: error.message });
    }
  },
};
