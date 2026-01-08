import { Router, Request, Response } from 'express';
import { keycloak, protect, extractUserInfo, checkRole } from '../middleware/keycloak.js';
import { prisma } from '../config/database.js';
import PDFDocument from 'pdfkit';

const router = Router();

// Get all invoices for organization
router.get('/', protect, extractUserInfo, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user?.organizationId) {
      return res.status(403).json({ error: 'User must belong to an organization' });
    }

    const invoices = await prisma.invoice.findMany({
      where: { organizationId: user.organizationId },
      include: {
        items: true,
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Download invoice as PDF
router.get('/:id/download', protect, extractUserInfo, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    console.log('Invoice download request:', { id, userId: user?.id, organizationId: user?.organizationId });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        organization: true,
      },
    });

    if (!invoice) {
      console.error('Invoice not found:', id);
      return res.status(404).json({ error: 'Invoice not found' });
    }

    console.log('Invoice found:', { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, organizationId: invoice.organizationId });

    // Check access
    if (invoice.organizationId !== user?.organizationId) {
      const roles = (req as any).kauth?.grant?.access_token?.content?.realm_access?.roles || [];
      if (!roles.includes('admin')) {
        console.error('Access denied:', { userOrg: user?.organizationId, invoiceOrg: invoice.organizationId });
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Set headers before creating PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);

    // Create PDF and pipe directly to response
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4'
    });
    
    doc.pipe(res);

    // Header
    doc.fontSize(24).text('INVOICE', { align: 'center' });
    doc.moveDown(1.5);

    // Invoice info - right aligned
    const startY = doc.y;
    doc.fontSize(10);
    doc.text(`Invoice: ${invoice.invoiceNumber}`, 400, startY, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}`, 400, startY + 15, { align: 'right' });
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 400, startY + 30, { align: 'right' });

    // From section
    doc.fontSize(11).text('From:', 50, startY + 70);
    doc.fontSize(10);
    doc.text('Ankiya Cloud Platform', 50, startY + 85);
    doc.text('Cloud Machine Services', 50, startY + 100);

    // To section
    doc.fontSize(11).text('To:', 50, startY + 130);
    doc.fontSize(10);
    doc.text(invoice.organization.name, 50, startY + 145);
    doc.text(invoice.organization.contactEmail, 50, startY + 160);

    // Items table
    const tableY = startY + 210;
    
    // Headers
    doc.fontSize(10);
    doc.text('Description', 50, tableY);
    doc.text('Qty', 370, tableY);
    doc.text('Price', 430, tableY);
    doc.text('Amount', 490, tableY);
    
    doc.moveTo(50, tableY + 15).lineTo(550, tableY + 15).stroke();

    // Items
    let currentY = tableY + 25;
    invoice.items.forEach((item) => {
      doc.text(item.description, 50, currentY, { width: 300 });
      doc.text(String(item.quantity), 370, currentY);
      doc.text(`₹${Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 430, currentY);
      doc.text(`₹${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 490, currentY);
      currentY += 35;
    });

    // Totals
    currentY += 10;
    doc.moveTo(370, currentY).lineTo(550, currentY).stroke();
    currentY += 15;

    doc.text('Subtotal:', 430, currentY);
    doc.text(`₹${Number(invoice.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 490, currentY);
    currentY += 20;

    doc.text('Tax (GST 18%):', 430, currentY);
    doc.text(`₹${Number(invoice.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 490, currentY);
    currentY += 25;

    doc.fontSize(12);
    doc.text('Total:', 430, currentY);
    doc.text(`₹${Number(invoice.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 490, currentY);

    // Payment info
    if (invoice.paidAt) {
      currentY += 40;
      doc.fontSize(10);
      doc.text(`Paid on: ${new Date(invoice.paidAt).toLocaleDateString('en-IN')}`, 430, currentY);
      if (invoice.razorpayPaymentId) {
        currentY += 15;
        doc.text(`Payment ID: ${invoice.razorpayPaymentId}`, 430, currentY);
      }
    }

    // Footer
    doc.fontSize(8);
    doc.text(
      'Thank you for your business!',
      50,
      750,
      { align: 'center', width: 500 }
    );

    doc.end();

  } catch (error: any) {
    console.error('Error generating invoice PDF:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate invoice PDF', message: error.message });
    }
  }
});

export default router;
