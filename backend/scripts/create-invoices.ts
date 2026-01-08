import { prisma } from '../src/config/database.js';

async function createInvoicesForPaidOrders() {
  try {
    // Get all paid orders without invoices
    const paidOrders = await prisma.machineOrder.findMany({
      where: {
        status: 'PAID',
      },
      include: {
        organization: true,
        machineConfig: true,
      },
    });

    console.log(`Found ${paidOrders.length} paid orders`);

    for (const order of paidOrders) {
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Calculate amounts (18% GST)
      const amount = Number(order.totalAmount);
      const taxAmount = amount * 0.18;
      const totalAmount = amount + taxAmount;

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          organizationId: order.organizationId,
          amount,
          taxAmount,
          totalAmount,
          status: 'PAID',
          dueDate: order.paidAt || new Date(),
          paidAt: order.paidAt,
          razorpayPaymentId: order.razorpayPaymentId,
          items: {
            create: {
              description: `${order.machineConfig.name} - ${order.quantity} machine(s) for ${order.duration} month(s)`,
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
      console.log(`   Amount: ₹${amount}, Tax: ₹${taxAmount.toFixed(2)}, Total: ₹${totalAmount.toFixed(2)}`);
    }

    console.log('\n✅ All invoices created!');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createInvoicesForPaidOrders();
