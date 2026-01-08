import cron from 'node-cron';
import prisma from '../config/database.js';
import { config } from '../config/index.js';
import { emailService } from '../services/emailService.js';

/**
 * Order Expiry Job
 * Runs every hour to auto-cancel orders in PENDING_PAYMENT status that are older than 24 hours
 */
export function startOrderExpiryJob() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running order expiry check...');
    
    try {
      const expiryHours = config.orders.expiryHours;
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() - expiryHours);

      // Find expired orders
      const expiredOrders = await prisma.machineOrder.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: {
            lt: expiryTime,
          },
        },
        include: {
          organization: true,
          machineConfig: true,
        },
      });

      if (expiredOrders.length === 0) {
        console.log('✅ No expired orders found');
        return;
      }

      console.log(`🔄 Found ${expiredOrders.length} expired orders to cancel`);

      // Cancel each expired order
      for (const order of expiredOrders) {
        try {
          await prisma.machineOrder.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' },
          });

          // Notify organization
          try {
            await emailService.sendOrderCancelledEmail(
              order.organization.contactEmail,
              order.orderNumber,
              order.machineConfig.name,
              order.quantity,
              'Auto-cancelled due to payment timeout (24 hours)'
            );
          } catch (emailError) {
            console.error(`Failed to send cancellation email for ${order.orderNumber}:`, emailError);
          }

          console.log(`  ❌ Cancelled order: ${order.orderNumber}`);
        } catch (orderError) {
          console.error(`  Failed to cancel order ${order.orderNumber}:`, orderError);
        }
      }

      console.log('✅ Order expiry check completed');
    } catch (error) {
      console.error('❌ Order expiry job failed:', error);
    }
  });

  console.log('📅 Order expiry job scheduled (runs every hour)');
}
