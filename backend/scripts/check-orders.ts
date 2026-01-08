import { prisma } from '../src/config/database.js';

async function checkOrders() {
  try {
    const orders = await prisma.machineOrder.findMany({
      include: {
        organization: true,
        machineConfig: true,
      },
    });

    console.log('\n=== Orders ===');
    console.log('Total orders:', orders.length);
    orders.forEach(order => {
      console.log('\nOrder:', order.id);
      console.log('  Order Number:', order.orderNumber);
      console.log('  Status:', order.status);
      console.log('  Total Amount:', order.totalAmount);
      console.log('  Organization:', order.organization?.name);
      console.log('  Config:', order.machineConfig?.name);
      console.log('  Paid At:', order.paidAt);
    });

    const invoices = await prisma.invoice.findMany({
      include: {
        organization: true,
      },
    });

    console.log('\n=== Invoices ===');
    console.log('Total invoices:', invoices.length);
    invoices.forEach(invoice => {
      console.log('\nInvoice:', invoice.id);
      console.log('  Status:', invoice.status);
      console.log('  Amount:', invoice.amount);
      console.log('  Organization:', invoice.organization?.name);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkOrders();
