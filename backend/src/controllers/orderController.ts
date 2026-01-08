import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { paymentService } from '../services/paymentService.js';
import { emailService } from '../services/emailService.js';
import { config } from '../config/index.js';

export const machineOrderController = {
  // Create machine order
  async createOrder(req: Request, res: Response) {
    try {
      const { machineConfigId, quantity, duration } = req.body;
      const organizationId = req.organizationId!;

      // Get machine config
      const machineConfig = await prisma.machineConfig.findUnique({
        where: { id: machineConfigId },
      });

      if (!machineConfig || !machineConfig.isActive) {
        return res.status(404).json({ error: 'Machine configuration not found' });
      }

      // Calculate total amount
      const monthlyPrice = Number(machineConfig.pricePerMonth);
      const totalAmount = monthlyPrice * quantity * duration;

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Create Razorpay order
      const razorpayOrder = await paymentService.createOrder(
        totalAmount,
        'INR',
        orderNumber
      );

      // Create machine order in database
      const order = await prisma.machineOrder.create({
        data: {
          orderNumber,
          organizationId,
          machineConfigId,
          quantity,
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
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        },
      });
    } catch (error: any) {
      console.error('Create order error:', error);
      res.status(500).json({ error: 'Failed to create order', details: error.message });
    }
  },

  // Verify payment and create ticket
  async verifyPayment(req: Request, res: Response) {
    try {
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

      // Update order status
      await prisma.machineOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          razorpayPaymentId: paymentId,
          paidAt: new Date(),
        },
      });

      // Create ticket for admin team
      const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          organizationId: order.organizationId,
          title: `Machine Provisioning Request - ${order.orderNumber}`,
          description: `Please provision ${order.quantity}x ${order.machineConfig.name} machines for ${order.duration} months.`,
          priority: order.quantity > 5 ? 'HIGH' : 'MEDIUM',
          status: 'OPEN',
          machineConfigId: order.machineConfigId,
          quantity: order.quantity,
        },
      });

      // Link ticket to order
      await prisma.machineOrder.update({
        where: { id: order.id },
        data: { ticketId: ticket.id },
      });

      // Create notifications for all admin users
      try {
        const adminUsers = await prisma.user.findMany({
          where: { role: 'SUPER_ADMIN' },
        });

        for (const admin of adminUsers) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: 'New Machine Request',
              message: `${order.organization.name} ordered ${order.quantity}x ${order.machineConfig.name} for ${order.duration} month(s). Total: ₹${(Number(order.totalAmount) / 100).toLocaleString()}`,
              type: 'MACHINE_REQUEST',
              entityType: 'ticket',
              entityId: ticket.id,
            },
          });
        }
      } catch (notifError) {
        console.error('Failed to create admin notifications:', notifError);
      }

      // Send confirmation email
      await emailService.sendOrderConfirmation(
        order.organization.contactEmail,
        order.orderNumber,
        Number(order.totalAmount)
      );

      // Send notification to admin
      try {
        await emailService.sendNewOrderNotification(
          config.admin.notificationEmail,
          order.orderNumber,
          order.organization.name,
          order.machineConfig.name,
          order.quantity,
          order.duration,
          Number(order.totalAmount)
        );
      } catch (emailError) {
        console.error('Failed to send admin notification:', emailError);
      }

      res.json({
        success: true,
        message: 'Payment verified successfully',
        ticket: {
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
        },
      });
    } catch (error: any) {
      console.error('Verify payment error:', error);
      res.status(500).json({ error: 'Failed to verify payment', details: error.message });
    }
  },

  // Get orders for organization
  async getOrders(req: Request, res: Response) {
    try {
      const organizationId = req.organizationId!;
      const { status } = req.query;

      const where: any = { organizationId };
      if (status) {
        where.status = status;
      }

      const orders = await prisma.machineOrder.findMany({
        where,
        include: {
          machineConfig: true,
          ticket: true,
          machines: {
            include: {
              assignments: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(orders);
    } catch (error: any) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    }
  },

  // Cancel order (only PENDING_PAYMENT orders)
  async cancelOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.organizationId!;

      // Find order
      const order = await prisma.machineOrder.findFirst({
        where: { 
          id, 
          organizationId,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Only allow cancellation of PENDING_PAYMENT orders
      if (order.status !== 'PENDING_PAYMENT') {
        return res.status(400).json({ 
          error: 'Only pending payment orders can be cancelled',
          currentStatus: order.status,
        });
      }

      // Update order status
      await prisma.machineOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      res.json({ 
        success: true, 
        message: 'Order cancelled successfully' 
      });
    } catch (error: any) {
      console.error('Cancel order error:', error);
      res.status(500).json({ error: 'Failed to cancel order', details: error.message });
    }
  },

  // Mock complete payment for pending orders (for development/testing)
  async mockCompletePayment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.organizationId!;

      // Find order
      const order = await prisma.machineOrder.findFirst({
        where: { 
          id, 
          organizationId,
        },
        include: {
          machineConfig: true,
          organization: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Only allow completion of PENDING_PAYMENT orders
      if (order.status !== 'PENDING_PAYMENT') {
        return res.status(400).json({ 
          error: 'Only pending payment orders can be completed',
          currentStatus: order.status,
        });
      }

      const mockPaymentId = `mock_${Date.now()}`;
      const paidAt = new Date();

      // Check if this is an extension order (starts with EXT-)
      const isExtensionOrder = order.orderNumber.startsWith('EXT-');

      // Create invoice for any payment
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const amount = Number(order.totalAmount);
      const taxAmount = amount * 0.18; // 18% GST
      const totalAmount = amount + taxAmount;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          organizationId: order.organizationId,
          amount,
          taxAmount,
          totalAmount,
          status: 'PAID',
          dueDate: paidAt,
          paidAt: paidAt,
          razorpayPaymentId: mockPaymentId,
          items: {
            create: {
              description: isExtensionOrder 
                ? `Machine Extension - ${order.machineConfig.name} for ${order.duration} month(s)`
                : `${order.machineConfig.name} - ${order.quantity} machine(s) for ${order.duration} month(s)`,
              quantity: order.quantity,
              unitPrice: amount / order.quantity,
              amount,
            },
          },
        },
        include: {
          items: true,
        },
      });

      console.log(`✅ Created invoice ${invoice.invoiceNumber} for order ${order.orderNumber}`);

      if (isExtensionOrder) {
        // For extension orders, we need to find and extend the machine
        const existingMachine = await prisma.machine.findFirst({
          where: {
            organizationId,
            machineConfigId: order.machineConfigId,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (existingMachine) {
          // Calculate new expiry date
          const currentExpiry = new Date(existingMachine.expiryDate);
          const now = new Date();
          const baseDate = currentExpiry < now ? now : currentExpiry;
          const newExpiryDate = new Date(baseDate);
          newExpiryDate.setMonth(newExpiryDate.getMonth() + order.duration);

          // Update machine expiry
          await prisma.machine.update({
            where: { id: existingMachine.id },
            data: {
              expiryDate: newExpiryDate,
              status: existingMachine.status === 'EXPIRED' ? 'ACTIVE' : existingMachine.status,
            },
          });

          // Create a resolved ticket for tracking
          const ticketNumber = `EXT-TKT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
          const ticket = await prisma.ticket.create({
            data: {
              ticketNumber,
              organizationId: order.organizationId,
              title: `Machine Extension Completed - ${existingMachine.name}`,
              description: `Machine ${existingMachine.name} extended by ${order.duration} month(s). New expiry date: ${newExpiryDate.toLocaleDateString()}.`,
              priority: 'LOW',
              status: 'RESOLVED',
              resolvedAt: new Date(),
            },
          });

          // Update order status to completed
          await prisma.machineOrder.update({
            where: { id },
            data: { 
              status: 'COMPLETED',
              ticketId: ticket.id,
              razorpayPaymentId: mockPaymentId,
              paidAt: paidAt,
            },
          });

          return res.json({ 
            success: true, 
            message: 'Extension payment completed',
            invoiceNumber: invoice.invoiceNumber,
            ticketNumber: ticket.ticketNumber,
            machine: {
              id: existingMachine.id,
              name: existingMachine.name,
              newExpiryDate,
            },
          });
        } else {
          return res.status(404).json({ error: 'Machine not found for extension' });
        }
      }

      // For regular orders, create ticket and mark as paid
      const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          organizationId: order.organizationId,
          title: `Machine Provisioning Request - ${order.orderNumber}`,
          description: `Please provision ${order.quantity}x ${order.machineConfig.name} machines for ${order.duration} months.\n\nOrder Details:\n- Config: ${order.machineConfig.cpu}, ${order.machineConfig.ram}, ${order.machineConfig.storage}\n- Duration: ${order.duration} month(s)\n- Total: ₹${amount.toLocaleString()}`,
          priority: order.quantity > 5 ? 'HIGH' : 'MEDIUM',
          status: 'OPEN',
          machineConfigId: order.machineConfigId,
          quantity: order.quantity,
        },
      });

      console.log(`✅ Created ticket ${ticket.ticketNumber} for order ${order.orderNumber}`);

      // Update order status
      await prisma.machineOrder.update({
        where: { id },
        data: { 
          status: 'PAID',
          ticketId: ticket.id,
          razorpayPaymentId: mockPaymentId,
          paidAt: paidAt,
        },
      });

      // Create notifications for admins
      try {
        const adminUsers = await prisma.user.findMany({
          where: { role: 'SUPER_ADMIN' },
        });

        for (const admin of adminUsers) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: 'New Machine Request',
              message: `${order.organization.name} ordered ${order.quantity}x ${order.machineConfig.name} for ${order.duration} month(s). Total: ₹${amount.toLocaleString()}`,
              type: 'MACHINE_REQUEST',
              entityType: 'ticket',
              entityId: ticket.id,
            },
          });
        }
      } catch (notifError) {
        console.error('Failed to create admin notifications:', notifError);
      }

      // Try to send confirmation email
      try {
        await emailService.sendOrderConfirmation(
          order.organization.contactEmail,
          order.orderNumber,
          amount
        );
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
      }

      res.json({ 
        success: true, 
        message: 'Payment completed successfully',
        invoiceNumber: invoice.invoiceNumber,
        ticketNumber: ticket.ticketNumber,
      });
    } catch (error: any) {
      console.error('Mock complete payment error:', error);
      res.status(500).json({ error: 'Failed to complete payment', details: error.message });
    }
  },
};
