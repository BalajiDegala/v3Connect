import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { emailService } from '../services/emailService.js';
import { config } from '../config/index.js';
import crypto from 'crypto';

export const adminController = {
  // Get all tickets (admin only)
  async getTickets(req: Request, res: Response) {
    try {
      const { status, priority } = req.query;

      const where: any = {};
      if (status) where.status = status;
      if (priority) where.priority = priority;

      const tickets = await prisma.ticket.findMany({
        where,
        include: {
          organization: true,
          machineOrder: {
            include: {
              machineConfig: true,
            },
          },
          machines: true,
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      res.json(tickets);
    } catch (error: any) {
      console.error('Get tickets error:', error);
      res.status(500).json({ error: 'Failed to fetch tickets', details: error.message });
    }
  },

  // Update ticket status
  async updateTicket(req: Request, res: Response) {
    try {
      const { ticketId } = req.params;
      const { status, assignedToAdminId } = req.body;

      const ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status,
          assignedToAdminId,
          updatedAt: new Date(),
          resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
        },
        include: {
          organization: true,
        },
      });

      // Send email notification
      await emailService.sendTicketUpdate(
        ticket.organization.contactEmail,
        ticket.ticketNumber,
        status
      );

      res.json(ticket);
    } catch (error: any) {
      console.error('Update ticket error:', error);
      res.status(500).json({ error: 'Failed to update ticket', details: error.message });
    }
  },

  // Provision machine (simplified flow - from order directly)
  async provisionMachine(req: Request, res: Response) {
    try {
      const {
        orderId,
        name,
        dcvLink,
        ipAddress,
        loginUsername,
        loginPassword,
        // Legacy support for ticket-based flow
        ticketId,
        machineName,
        dcvHost,
        dcvPort,
        dcvUsername,
        startDate,
        expiryDate,
      } = req.body;

      // New simplified flow (order-based)
      if (orderId) {
        const order = await prisma.machineOrder.findUnique({
          where: { id: orderId },
          include: {
            organization: true,
            machineConfig: true,
            machines: true,
          },
        });

        if (!order) {
          return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status !== 'PAID' && order.status !== 'PROCESSING') {
          return res.status(400).json({ error: 'Order is not in a provisionable state' });
        }

        // Check if we can add more machines
        const existingCount = order.machines?.length || 0;
        if (existingCount >= order.quantity) {
          return res.status(400).json({ error: 'All machines for this order have been provisioned' });
        }

        // Calculate dates
        const machineStartDate = new Date();
        const machineExpiryDate = new Date();
        machineExpiryDate.setMonth(machineExpiryDate.getMonth() + order.duration);

        // Create machine
        const machine = await prisma.machine.create({
          data: {
            name: name || machineName,
            organizationId: order.organizationId,
            machineConfigId: order.machineConfigId,
            orderId: order.id,
            ticketId: order.ticketId,
            dcvLink: dcvLink,
            dcvHost: ipAddress || dcvHost,
            loginUsername: loginUsername || undefined,
            loginPassword: loginPassword || undefined,
            status: 'ACTIVE',
            startDate: machineStartDate,
            expiryDate: machineExpiryDate,
            provisionedAt: new Date(),
          },
          include: {
            machineConfig: true,
            organization: true,
          },
        });

        // Check if all machines are provisioned
        const newCount = existingCount + 1;
        let orderStatus: string = order.status;
        
        if (newCount >= order.quantity) {
          // All machines provisioned
          await prisma.machineOrder.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' },
          });
          orderStatus = 'COMPLETED';

          // Update ticket if exists
          if (order.ticketId) {
            await prisma.ticket.update({
              where: { id: order.ticketId },
              data: { status: 'RESOLVED', resolvedAt: new Date() },
            });
          }
        } else if (order.status === 'PAID') {
          // Mark as processing
          await prisma.machineOrder.update({
            where: { id: order.id },
            data: { status: 'PROCESSING' },
          });
          orderStatus = 'PROCESSING';
        }

        // Send email to organization admins
        try {
          await emailService.sendMachineReadyEmail(
            order.organization.contactEmail,
            order.organization.name,
            machine.name,
            `${order.machineConfig.name} (${order.machineConfig.cpu}, ${order.machineConfig.ram})`,
            dcvLink,
            machineExpiryDate.toLocaleDateString()
          );
        } catch (emailError) {
          console.error('Failed to send machine ready email:', emailError);
        }

        // Create notification for studio admins about machine provisioned
        try {
          const studioAdmins = await prisma.user.findMany({
            where: {
              organizationId: order.organizationId,
              role: { in: ['STUDIO_ADMIN', 'STUDIO_MANAGER'] },
            },
          });

          for (const studioAdmin of studioAdmins) {
            await prisma.notification.create({
              data: {
                userId: studioAdmin.id,
                title: 'Machine Provisioned',
                message: `Your machine "${machine.name}" (${order.machineConfig.name}) has been provisioned and is ready to use.`,
                type: 'SUCCESS',
                entityType: 'machine',
                entityId: machine.id,
              },
            });
          }
        } catch (notifError) {
          console.error('Failed to create studio notifications:', notifError);
        }

        return res.status(201).json({
          success: true,
          machine,
          orderStatus,
          provisioned: newCount,
          total: order.quantity,
          message: `Machine provisioned (${newCount}/${order.quantity})`,
        });
      }

      // Legacy ticket-based flow
      if (ticketId) {
        // Get ticket
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            organization: true,
            machineOrder: {
              include: {
                machineConfig: true,
              },
            },
          },
        });

        if (!ticket || !ticket.machineOrder) {
          return res.status(404).json({ error: 'Ticket or order not found' });
        }

        // Generate random password
        const dcvPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
        
        // Create DCV link from host:port
        const dcvLinkGenerated = `dcv://${dcvHost}:${dcvPort}`;

        // Create machine
        const machine = await prisma.machine.create({
          data: {
            name: machineName,
            organizationId: ticket.organizationId,
            machineConfigId: ticket.machineOrder.machineConfigId,
            orderId: ticket.machineOrder.id,
            ticketId: ticket.id,
            dcvHost,
            dcvPort,
            dcvUsername,
            dcvPassword,
            dcvLink: dcvLinkGenerated,
            status: 'ACTIVE',
            startDate: new Date(startDate),
            expiryDate: new Date(expiryDate),
            provisionedAt: new Date(),
          },
          include: {
            machineConfig: true,
          },
        });

        // Update order status
        await prisma.machineOrder.update({
          where: { id: ticket.machineOrder.id },
          data: { status: 'COMPLETED' },
        });

        // Update ticket
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'RESOLVED', resolvedAt: new Date() },
        });

        return res.status(201).json({
          success: true,
          machine,
          message: 'Machine provisioned successfully',
        });
      }

      return res.status(400).json({ error: 'Either orderId or ticketId is required' });
    } catch (error: any) {
      console.error('Provision machine error:', error);
      res.status(500).json({ error: 'Failed to provision machine', details: error.message });
    }
  },

  // Assign machine to user
  async assignMachine(req: Request, res: Response) {
    try {
      const { machineId, userId, task } = req.body;

      // Get machine and user
      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        include: { machineConfig: true },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!machine || !user) {
        return res.status(404).json({ error: 'Machine or user not found' });
      }

      // Check if they're in the same organization
      if (machine.organizationId !== user.organizationId) {
        return res.status(403).json({ error: 'User and machine must be in the same organization' });
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

      // Update machine status
      await prisma.machine.update({
        where: { id: machineId },
        data: { status: 'RUNNING' },
      });

      // Send email to user (simplified - no credentials, user uses their own)
      try {
        await emailService.sendMachineAssignedEmail(
          user.email,
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          machine.name,
          `${machine.machineConfig.name} (${machine.machineConfig.cpu}, ${machine.machineConfig.ram})`,
          machine.dcvLink!,
          task || undefined
        );
        
        // Mark email as sent
        await prisma.machineAssignment.update({
          where: { id: assignment.id },
          data: {
            emailSent: true,
            emailSentAt: new Date(),
          },
        });
      } catch (emailError) {
        console.error('Failed to send assignment email:', emailError);
      }

      res.json({
        success: true,
        assignment,
        message: 'Machine assigned and credentials sent to user',
      });
    } catch (error: any) {
      console.error('Assign machine error:', error);
      res.status(500).json({ error: 'Failed to assign machine', details: error.message });
    }
  },

  // Get all machines (admin view)
  async getAllMachines(req: Request, res: Response) {
    try {
      const { status, organizationId } = req.query;

      const where: any = {};
      if (status) where.status = status;
      if (organizationId) where.organizationId = organizationId;

      const machines = await prisma.machine.findMany({
        where,
        include: {
          organization: true,
          machineConfig: true,
          assignments: {
            include: {
              user: true,
            },
            where: {
              unassignedAt: null,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(machines);
    } catch (error: any) {
      console.error('Get all machines error:', error);
      res.status(500).json({ error: 'Failed to fetch machines', details: error.message });
    }
  },

  // Unassign machine from user
  async unassignMachine(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Find the machine
      const machine = await prisma.machine.findUnique({
        where: { id },
        include: {
          assignments: {
            where: { unassignedAt: null },
            include: { user: true },
          },
        },
      });

      if (!machine) {
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

      // Send notification email to user
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
};
