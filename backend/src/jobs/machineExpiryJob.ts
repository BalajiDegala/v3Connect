import cron from 'node-cron';
import prisma from '../config/database.js';

/**
 * Machine Expiry Job
 * Runs every hour to mark machines as EXPIRED when their expiryDate has passed
 */
export function startMachineExpiryJob() {
  // Run every hour at minute 30
  cron.schedule('30 * * * *', async () => {
    console.log('⏰ Running machine expiry check...');
    
    try {
      const now = new Date();

      // Find active machines that have passed their expiry date
      const expiredMachines = await prisma.machine.findMany({
        where: {
          status: { in: ['ACTIVE', 'RUNNING'] },
          expiryDate: {
            lt: now,
          },
        },
        include: {
          machineConfig: true,
          organization: true,
        },
      });

      if (expiredMachines.length === 0) {
        console.log('✅ No expired machines found');
        return;
      }

      console.log(`🔄 Found ${expiredMachines.length} expired machines to mark as EXPIRED`);

      // Update each expired machine
      for (const machine of expiredMachines) {
        try {
          await prisma.machine.update({
            where: { id: machine.id },
            data: { status: 'EXPIRED' },
          });

          console.log(`  ❌ Expired machine: ${machine.name} (org: ${machine.organization.name})`);
        } catch (machineError) {
          console.error(`  Failed to expire machine ${machine.name}:`, machineError);
        }
      }

      console.log('✅ Machine expiry check completed');
    } catch (error) {
      console.error('❌ Machine expiry job failed:', error);
    }
  });

  console.log('📅 Machine expiry job scheduled (runs every hour at :30)');
}
